import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { client_id, message } = await request.json();
    if (!client_id || !message) {
      return NextResponse.json({ error: "Missing client_id or message" }, { status: 400 });
    }

    // Get client name for the notification title
    const supabase = await createClient();
    const { data: orgData } = await supabase
      .from("orgs")
      .select("name")
      .eq("id", org.orgId)
      .single();

    const trainerName = orgData?.name || "Your Trainer";

    // Call push-dispatch edge function using service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn("Push notification skipped: missing SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ sent: 0, skipped: true });
    }

    const pushResponse = await fetch(
      `${supabaseUrl}/functions/v1/push-dispatch`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          client_id,
          title: trainerName,
          body: message.length > 100 ? message.substring(0, 100) + "..." : message,
          data: { type: "message", client_id },
        }),
      }
    );

    const result = await pushResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Send push error:", error);
    return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
  }
}
