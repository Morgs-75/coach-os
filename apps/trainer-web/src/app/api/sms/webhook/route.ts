import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This webhook handles incoming SMS replies (e.g., from Twilio)
// When a client replies "Y" to confirm their booking

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    // Parse the incoming webhook (Twilio format)
    const formData = await request.formData();
    const from = formData.get("From") as string; // Client's phone number
    const body = (formData.get("Body") as string)?.trim().toUpperCase();

    if (!from || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Clean phone number (remove +, spaces, etc.)
    const cleanPhone = from.replace(/\D/g, "");

    // Find client by phone number
    const { data: client } = await supabase
      .from("clients")
      .select("id, org_id, full_name")
      .or(`phone.eq.${from},phone.eq.${cleanPhone},phone.ilike.%${cleanPhone.slice(-9)}%`)
      .single();

    if (!client) {
      console.log("SMS webhook: Client not found for phone", from);
      return NextResponse.json({ message: "Client not found" });
    }

    // Check if this is a confirmation reply (Y, YES, CONFIRM, etc.)
    const isConfirmation = ["Y", "YES", "CONFIRM", "CONFIRMED", "YEP", "YEA", "YEAH"].includes(body);

    if (isConfirmation) {
      // DISABLED: This handler is inactive. Twilio inbound webhook points to /api/sms-inbound.
      // This route queried client_confirmed IS NULL but the column defaults to false — it could
      // never match a booking. Keeping the route to avoid 404s on any stray Twilio retries,
      // but confirmation is handled exclusively by /api/sms-inbound.
      console.log("SMS webhook /api/sms/webhook: confirmation reply received but handler is disabled — use /api/sms-inbound");
    } else {
      // Log any other incoming SMS
      await supabase.from("client_communications").insert({
        org_id: client.org_id,
        client_id: client.id,
        type: "sms",
        direction: "inbound",
        subject: "SMS Reply",
        content: body,
      });
    }

    // Save to message thread so it appears in the conversation
    const { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("org_id", client.org_id)
      .eq("client_id", client.id)
      .single();

    if (thread) {
      await supabase.from("messages").insert({
        org_id: client.org_id,
        thread_id: thread.id,
        sender_type: "client",
        body: (formData.get("Body") as string)?.trim() || body,
      });
    }

    // Return TwiML response (empty response is fine)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("SMS webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
