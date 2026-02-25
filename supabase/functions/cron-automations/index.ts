import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Automation {
  id: string;
  org_id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  guardrails: GuardrailConfig;
}

interface TriggerConfig {
  type: "schedule" | "event";
  schedule?: string; // cron expression or "daily", "weekly"
  event?: string; // "risk_red", "payment_failed", "inactivity", "milestone"
}

interface ConditionConfig {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "in" | "contains";
  value: unknown;
}

interface ActionConfig {
  type: "send_message" | "send_push" | "create_offer" | "tag_client" | "notify_trainer";
  params: Record<string, unknown>;
}

interface GuardrailConfig {
  max_per_client_per_day?: number;
  max_per_client_per_week?: number;
  quiet_hours_start?: number; // 0-23
  quiet_hours_end?: number;
  dedupe_hours?: number;
}

interface ClientContext {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  status: string;
  risk_tier: string | null;
  risk_score: number | null;
  subscription_status: string | null;
  last_activity_at: string | null;
  days_since_activity: number | null;
}

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all enabled automations
    const { data: automations, error: autoError } = await supabase
      .from("automations")
      .select("*")
      .eq("enabled", true);

    if (autoError) throw autoError;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ processed: 0, runs: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let totalRuns = 0;

    for (const automation of automations as Automation[]) {
      const runs = await processAutomation(supabase, automation);
      totalRuns += runs;
    }

    return new Response(
      JSON.stringify({ processed: automations.length, runs: totalRuns }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Automation cron failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

function isScheduleDue(schedule: string, lastFiredAt: string | null): boolean {
  if (!lastFiredAt) return true; // Never fired — always due
  const now = Date.now();
  const last = new Date(lastFiredAt).getTime();
  const elapsed = now - last;
  if (schedule === "daily") return elapsed >= 24 * 60 * 60 * 1000;
  if (schedule === "weekly") return elapsed >= 7 * 24 * 60 * 60 * 1000;
  // Unknown schedule strings: fire (safe default, matches current behaviour for event triggers)
  return true;
}

async function processAutomation(
  supabase: ReturnType<typeof createClient>,
  automation: Automation
): Promise<number> {
  // Check if trigger should fire
  if (automation.trigger.type === "schedule") {
    const { data: lastRun } = await supabase
      .from("automation_runs")
      .select("fired_at")
      .eq("automation_id", automation.id)
      .eq("status", "ok")
      .order("fired_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastFiredAt = lastRun?.fired_at ?? null;
    if (!isScheduleDue(automation.trigger.schedule ?? "", lastFiredAt)) {
      return 0;
    }
  } else if (automation.trigger.type === "event") {
    // Event triggers always proceed (evaluated by conditions)
  } else {
    return 0;
  }

  // Get eligible clients for this org
  const clients = await getClientsWithContext(supabase, automation.org_id);
  let runsCreated = 0;

  for (const client of clients) {
    // Check conditions
    if (!evaluateConditions(automation.conditions, client)) {
      continue;
    }

    // Check guardrails
    const guardrailResult = await checkGuardrails(
      supabase,
      automation,
      client.id
    );

    if (!guardrailResult.allowed) {
      await recordRun(supabase, automation, client.id, "skipped", guardrailResult.reason, []);
      continue;
    }

    // Execute actions
    const actionResults = await executeActions(supabase, automation.actions, client, automation.org_id);

    await recordRun(supabase, automation, client.id, "ok", null, actionResults);
    runsCreated++;
  }

  return runsCreated;
}

async function getClientsWithContext(
  supabase: ReturnType<typeof createClient>,
  orgId: string
): Promise<ClientContext[]> {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();

  // Get clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, org_id, full_name, email, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (!clients) return [];

  const contexts: ClientContext[] = [];

  for (const client of clients) {
    // Get risk data
    const { data: risk } = await supabase
      .from("client_risk")
      .select("tier, score")
      .eq("client_id", client.id)
      .eq("as_of_date", today)
      .single();

    // Get subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("client_id", client.id)
      .single();

    // Get last activity
    const { data: lastActivity } = await supabase
      .from("activity_events")
      .select("created_at")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let daysSinceActivity: number | null = null;
    if (lastActivity?.created_at) {
      daysSinceActivity = Math.floor(
        (now.getTime() - new Date(lastActivity.created_at).getTime()) / (24 * 60 * 60 * 1000)
      );
    }

    contexts.push({
      id: client.id,
      org_id: client.org_id,
      full_name: client.full_name,
      email: client.email,
      status: client.status,
      risk_tier: risk?.tier ?? null,
      risk_score: risk?.score ?? null,
      subscription_status: subscription?.status ?? null,
      last_activity_at: lastActivity?.created_at ?? null,
      days_since_activity: daysSinceActivity,
    });
  }

  return contexts;
}

function evaluateConditions(conditions: ConditionConfig[], client: ClientContext): boolean {
  for (const condition of conditions) {
    const clientValue = getFieldValue(client, condition.field);

    if (!evaluateCondition(clientValue, condition.operator, condition.value)) {
      return false;
    }
  }
  return true;
}

function getFieldValue(client: ClientContext, field: string): unknown {
  const fieldMap: Record<string, unknown> = {
    risk_tier: client.risk_tier,
    risk_score: client.risk_score,
    subscription_status: client.subscription_status,
    days_since_activity: client.days_since_activity,
    status: client.status,
  };
  return fieldMap[field];
}

function evaluateCondition(actual: unknown, operator: string, expected: unknown): boolean {
  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "contains":
      return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
    default:
      return false;
  }
}

async function checkGuardrails(
  supabase: ReturnType<typeof createClient>,
  automation: Automation,
  clientId: string
): Promise<{ allowed: boolean; reason: string | null }> {
  const guardrails = automation.guardrails;
  const now = new Date();

  // Check quiet hours
  if (guardrails.quiet_hours_start !== undefined && guardrails.quiet_hours_end !== undefined) {
    const currentHour = now.getHours();
    const start = guardrails.quiet_hours_start;
    const end = guardrails.quiet_hours_end;

    if (start < end) {
      if (currentHour >= start && currentHour < end) {
        return { allowed: false, reason: "Quiet hours" };
      }
    } else {
      // Wraps around midnight
      if (currentHour >= start || currentHour < end) {
        return { allowed: false, reason: "Quiet hours" };
      }
    }
  }

  // Check dedupe
  if (guardrails.dedupe_hours) {
    const dedupeTime = new Date(now.getTime() - guardrails.dedupe_hours * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("client_id", clientId)
      .eq("status", "ok")
      .gte("fired_at", dedupeTime);

    if (count && count > 0) {
      return { allowed: false, reason: `Already fired within ${guardrails.dedupe_hours}h` };
    }
  }

  // Check daily limit
  if (guardrails.max_per_client_per_day) {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const { count } = await supabase
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("client_id", clientId)
      .eq("status", "ok")
      .gte("fired_at", todayStart);

    if (count && count >= guardrails.max_per_client_per_day) {
      return { allowed: false, reason: "Daily limit reached" };
    }
  }

  // Check weekly limit
  if (guardrails.max_per_client_per_week) {
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("automation_runs")
      .select("*", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("client_id", clientId)
      .eq("status", "ok")
      .gte("fired_at", weekStart);

    if (count && count >= guardrails.max_per_client_per_week) {
      return { allowed: false, reason: "Weekly limit reached" };
    }
  }

  return { allowed: true, reason: null };
}

async function executeActions(
  supabase: ReturnType<typeof createClient>,
  actions: ActionConfig[],
  client: ClientContext,
  orgId: string
): Promise<ActionConfig[]> {
  const executedActions: ActionConfig[] = [];

  for (const action of actions) {
    try {
      await executeAction(supabase, action, client, orgId);
      executedActions.push(action);
    } catch (err) {
      console.error(`Action ${action.type} failed:`, err);
    }
  }

  return executedActions;
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  action: ActionConfig,
  client: ClientContext,
  orgId: string
): Promise<void> {
  switch (action.type) {
    case "send_message": {
      const body = interpolateTemplate(action.params.body as string, client);

      // Get or create thread
      let { data: thread } = await supabase
        .from("message_threads")
        .select("id")
        .eq("org_id", orgId)
        .eq("client_id", client.id)
        .single();

      if (!thread) {
        const { data: newThread } = await supabase
          .from("message_threads")
          .insert({ org_id: orgId, client_id: client.id })
          .select("id")
          .single();
        thread = newThread;
      }

      if (thread) {
        await supabase.from("messages").insert({
          org_id: orgId,
          thread_id: thread.id,
          sender_type: "system",
          body,
        });
      }
      break;
    }

    case "send_push": {
      const title = interpolateTemplate(action.params.title as string, client);
      const body = interpolateTemplate(action.params.body as string, client);

      // Call push-dispatch function
      await supabase.functions.invoke("push-dispatch", {
        body: { client_id: client.id, title, body },
      });
      break;
    }

    case "notify_trainer": {
      // Insert a system message or notification for trainer
      // For MVP, we create a message in the client's thread
      const body = interpolateTemplate(action.params.body as string, client);

      let { data: thread } = await supabase
        .from("message_threads")
        .select("id")
        .eq("org_id", orgId)
        .eq("client_id", client.id)
        .single();

      if (!thread) {
        const { data: newThread } = await supabase
          .from("message_threads")
          .insert({ org_id: orgId, client_id: client.id })
          .select("id")
          .single();
        thread = newThread;
      }

      if (thread) {
        await supabase.from("messages").insert({
          org_id: orgId,
          thread_id: thread.id,
          sender_type: "system",
          body: `[TRAINER ALERT] ${body}`,
        });
      }
      break;
    }

    case "create_offer":
    case "tag_client":
      // These would require additional schema/implementation
      console.log(`Action ${action.type} not yet implemented`);
      break;
  }
}

function interpolateTemplate(template: string, client: ClientContext): string {
  return template
    .replace(/\{\{name\}\}/g, client.full_name)
    .replace(/\{\{first_name\}\}/g, client.full_name.split(" ")[0])
    .replace(/\{\{days_inactive\}\}/g, String(client.days_since_activity ?? 0));
}

async function recordRun(
  supabase: ReturnType<typeof createClient>,
  automation: Automation,
  clientId: string,
  status: "ok" | "skipped" | "failed",
  reason: string | null,
  actionsFired: ActionConfig[]
): Promise<void> {
  await supabase.from("automation_runs").insert({
    org_id: automation.org_id,
    automation_id: automation.id,
    client_id: clientId,
    status,
    reason,
    actions_fired: actionsFired,
  });
}
