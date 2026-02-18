import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SendSmsRequest {
  client_id: string;
  template_key: string;
  variables: Record<string, string>;
  scheduled_for?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  idempotency_key?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user's org_id from JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body: SendSmsRequest = await req.json();

  try {
    // Get client and verify org membership
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, org_id, full_name, phone")
      .eq("id", body.client_id)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), { status: 404 });
    }

    // Verify user is org member
    const { data: membership } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", client.org_id)
      .eq("user_id", userData.user.id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not authorized for this org" }), { status: 403 });
    }

    // Validate phone
    if (!client.phone || !client.phone.match(/^\+\d{10,15}$/)) {
      return new Response(JSON.stringify({ error: "Invalid or missing phone number" }), { status: 400 });
    }

    // Check suppression
    const { data: suppressed } = await supabase.rpc("is_phone_suppressed", {
      p_org_id: client.org_id,
      p_phone: client.phone,
    });

    if (suppressed) {
      return new Response(JSON.stringify({ error: "Phone number is suppressed (opt-out)" }), { status: 400 });
    }

    // Get SMS settings and template
    const { data: settings } = await supabase
      .from("sms_settings")
      .select("*")
      .eq("org_id", client.org_id)
      .single();

    if (!settings || !settings.enabled) {
      return new Response(JSON.stringify({ error: "SMS not enabled for this org" }), { status: 400 });
    }

    const { data: template } = await supabase
      .from("sms_templates")
      .select("*")
      .eq("org_id", client.org_id)
      .eq("template_key", body.template_key)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!template) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 });
    }

    // Render template
    const { data: renderedBody } = await supabase.rpc("render_sms_template", {
      p_template_body: template.body,
      p_variables: body.variables,
    });

    // Check rate limits
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: todayCount } = await supabase
      .from("sms_messages")
      .select("id", { count: "exact", head: true })
      .eq("org_id", client.org_id)
      .eq("client_id", body.client_id)
      .gte("created_at", oneDayAgo);

    if (todayCount && todayCount >= (settings.max_sms_per_client_per_day || 5)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded for client" }), { status: 429 });
    }

    // Determine from_phone
    const fromPhone = settings.twilio_messaging_service_sid || settings.twilio_phone_number;
    if (!fromPhone) {
      return new Response(JSON.stringify({ error: "No Twilio sender configured" }), { status: 500 });
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from("sms_messages")
      .insert({
        org_id: client.org_id,
        client_id: body.client_id,
        to_phone: client.phone,
        from_phone: fromPhone,
        template_id: template.id,
        template_key: body.template_key,
        body: renderedBody,
        variables: body.variables,
        related_entity_type: body.related_entity_type,
        related_entity_id: body.related_entity_id,
        scheduled_for: body.scheduled_for || new Date().toISOString(),
        idempotency_key: body.idempotency_key,
        status: "pending",
      })
      .select()
      .single();

    if (messageError) {
      // Check for idempotency key conflict
      if (messageError.code === "23505") {
        return new Response(JSON.stringify({ error: "Duplicate request (idempotency key conflict)" }), { status: 409 });
      }
      throw messageError;
    }

    // Transition to queued if ready
    await supabase.rpc("queue_pending_sms");

    return new Response(JSON.stringify({ message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send SMS error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
