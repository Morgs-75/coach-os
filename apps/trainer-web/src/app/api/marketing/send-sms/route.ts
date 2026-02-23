import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, recipient_filter } = await request.json() as {
      message: string;
      recipient_filter: "all" | "active";
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
      return NextResponse.json({ error: "SMS not configured" }, { status: 500 });
    }

    const supabase = await createClient();

    // Check SMS is enabled for this org
    const { data: smsSettings } = await supabase
      .from("sms_settings")
      .select("enabled")
      .eq("org_id", org.orgId)
      .maybeSingle();

    if (smsSettings && smsSettings.enabled === false) {
      return NextResponse.json({ error: "SMS is disabled for this organisation" }, { status: 400 });
    }

    // Fetch recipients
    let clientsQuery = supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("org_id", org.orgId)
      .not("phone", "is", null)
      .neq("phone", "");

    if (recipient_filter === "active") {
      // Clients with a booking in the last 90 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data: activeIds } = await supabase
        .from("bookings")
        .select("client_id")
        .eq("org_id", org.orgId)
        .gte("start_time", cutoff.toISOString());

      const ids = [...new Set((activeIds ?? []).map((r) => r.client_id))];
      if (ids.length === 0) {
        return NextResponse.json({ sent: 0, failed: 0, total: 0 });
      }
      clientsQuery = clientsQuery.in("id", ids);
    }

    const { data: clients, error: clientsError } = await clientsQuery;
    if (clientsError) {
      return NextResponse.json({ error: clientsError.message }, { status: 500 });
    }
    if (!clients || clients.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, total: 0 });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const client of clients) {
      const firstName = client.full_name?.split(" ")[0] ?? "there";
      const personalised = message.replace(/\{name\}/g, firstName);

      try {
        await twilioClient.messages.create({
          body: personalised,
          from,
          to: client.phone,
        });

        await supabase.from("client_communications").insert({
          org_id: org.orgId,
          client_id: client.id,
          type: "sms",
          direction: "outbound",
          subject: "Marketing SMS",
          content: personalised,
        });

        sent++;
      } catch (err) {
        failed++;
        errors.push(`${client.full_name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({ sent, failed, total: clients.length, errors });
  } catch (error) {
    console.error("Marketing SMS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send" },
      { status: 500 }
    );
  }
}
