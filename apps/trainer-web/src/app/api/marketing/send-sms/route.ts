import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

interface Recipient {
  name: string;
  phone: string;
  client_id?: string;
}

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as {
      message: string;
      recipient_filter: "all" | "active" | "manual";
      client_ids?: string[];
      lead_ids?: string[];
    };

    const { message, recipient_filter, client_ids = [], lead_ids = [] } = body;

    if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) return NextResponse.json({ error: "SMS not configured" }, { status: 500 });

    const supabase = await createClient();

    const { data: smsSettings } = await supabase
      .from("sms_settings").select("enabled").eq("org_id", org.orgId).maybeSingle();
    if (smsSettings?.enabled === false) {
      return NextResponse.json({ error: "SMS is disabled for this organisation" }, { status: 400 });
    }

    // Resolve coach name from org
    const { data: orgData } = await supabase
      .from("orgs").select("name").eq("id", org.orgId).maybeSingle();
    const coachName = orgData?.name ?? "";

    const recipients: Recipient[] = [];

    if (recipient_filter === "manual") {
      // Fetch selected clients
      if (client_ids.length > 0) {
        const { data } = await supabase.from("clients")
          .select("id, full_name, phone")
          .eq("org_id", org.orgId).in("id", client_ids)
          .not("phone", "is", null).neq("phone", "");
        (data ?? []).forEach(c => recipients.push({ name: c.full_name, phone: c.phone!, client_id: c.id }));
      }
      // Fetch selected leads
      if (lead_ids.length > 0) {
        const { data } = await supabase.from("inquiries")
          .select("id, name, phone")
          .eq("org_id", org.orgId).in("id", lead_ids)
          .not("phone", "is", null).neq("phone", "");
        (data ?? []).forEach(l => recipients.push({ name: l.name, phone: l.phone! }));
      }
    } else {
      let clientsQuery = supabase.from("clients")
        .select("id, full_name, phone")
        .eq("org_id", org.orgId)
        .not("phone", "is", null).neq("phone", "");

      if (recipient_filter === "active") {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const { data: activeIds } = await supabase.from("bookings")
          .select("client_id").eq("org_id", org.orgId).gte("start_time", cutoff.toISOString());
        const ids = [...new Set((activeIds ?? []).map(r => r.client_id))];
        if (!ids.length) return NextResponse.json({ sent: 0, failed: 0, total: 0 });
        clientsQuery = clientsQuery.in("id", ids);
      }

      const { data, error } = await clientsQuery;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      (data ?? []).forEach(c => recipients.push({ name: c.full_name, phone: c.phone!, client_id: c.id }));
    }

    if (!recipients.length) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      const firstName = recipient.name?.split(" ")[0] ?? "there";
      const personalised = message
          .replace(/\{name\}/g, firstName)
          .replace(/\{coach_name\}/g, coachName);

      try {
        await twilioClient.messages.create({ body: personalised, from, to: recipient.phone });

        if (recipient.client_id) {
          await supabase.from("client_communications").insert({
            org_id: org.orgId,
            client_id: recipient.client_id,
            type: "sms",
            direction: "outbound",
            subject: "Marketing SMS",
            content: personalised,
          });
        }

        sent++;
      } catch (err) {
        failed++;
        errors.push(`${recipient.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ sent, failed, total: recipients.length, errors });
  } catch (error) {
    console.error("Marketing SMS error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send" }, { status: 500 });
  }
}
