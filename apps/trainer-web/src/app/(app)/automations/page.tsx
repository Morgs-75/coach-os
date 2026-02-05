import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { clsx } from "clsx";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  return membership?.org_id ?? null;
}

export default async function AutomationsPage() {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  const { data: automations } = await supabase
    .from("automations")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // Get recent runs
  const { data: recentRuns } = await supabase
    .from("automation_runs")
    .select("*, automations(name), clients(full_name)")
    .eq("org_id", orgId)
    .order("fired_at", { ascending: false })
    .limit(20);

  const runStats = recentRuns?.reduce(
    (acc, run) => {
      acc[run.status] = (acc[run.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Automations</h1>
        <Link href="/automations/new" className="btn-primary">
          Create Automation
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Active Automations</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-gray-100">
            {automations?.filter((a) => a.enabled).length ?? 0}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Runs Today</p>
          <p className="mt-2 text-3xl font-semibold text-green-600">
            {runStats.ok ?? 0}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-500">Skipped (Guardrails)</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {runStats.skipped ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Automations List */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your Automations</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {automations && automations.length > 0 ? (
              automations.map((auto: any) => (
                <Link
                  key={auto.id}
                  href={`/automations/${auto.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-800"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{auto.name}</p>
                      <span
                        className={clsx(
                          "px-2 py-0.5 rounded text-xs font-medium",
                          auto.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500"
                        )}
                      >
                        {auto.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                      Trigger: {auto.trigger?.type ?? "unknown"} • {auto.actions?.length ?? 0} action(s)
                    </p>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500">→</span>
                </Link>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-4">No automations yet</p>
                <Link href="/automations/new" className="btn-primary">
                  Create your first automation
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Runs */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Runs</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            {recentRuns && recentRuns.length > 0 ? (
              recentRuns.map((run: any) => (
                <div key={run.id} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {run.automations?.name ?? "Unknown"}
                    </span>
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded text-xs font-medium",
                        run.status === "ok" && "bg-green-100 text-green-700",
                        run.status === "skipped" && "bg-amber-100 text-amber-700",
                        run.status === "failed" && "bg-red-100 text-red-700"
                      )}
                    >
                      {run.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {run.clients?.full_name ?? "Unknown client"}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">{formatDate(run.fired_at)}</span>
                  </div>
                  {run.reason && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{run.reason}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="px-6 py-8 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">No runs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Template Gallery */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Automation Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Re-engage Inactive Clients",
              description: "Send a message when a client hasn't logged activity in 7 days",
              trigger: "inactivity",
            },
            {
              name: "Failed Payment Follow-up",
              description: "Notify trainer and send reminder when payment fails",
              trigger: "payment_failed",
            },
            {
              name: "High Risk Alert",
              description: "Alert trainer when client reaches red risk tier",
              trigger: "risk_red",
            },
          ].map((template) => (
            <div key={template.name} className="card p-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{template.description}</p>
              <button className="btn-secondary mt-4 w-full text-sm">
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
