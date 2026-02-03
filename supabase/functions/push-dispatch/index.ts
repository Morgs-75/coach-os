import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushRequest {
  client_id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Verify internal call or cron secret
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  const isServiceCall = authHeader?.includes(serviceRoleKey ?? "");
  const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isServiceCall && !isCronCall) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: PushRequest | PushRequest[] = await req.json();
    const requests = Array.isArray(payload) ? payload : [payload];

    const results = await Promise.all(
      requests.map((r) => sendPushNotification(supabase, r))
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ sent: successful, failed, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Push dispatch failed:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function sendPushNotification(
  supabase: ReturnType<typeof createClient>,
  request: PushRequest
): Promise<{ success: boolean; error?: string }> {
  // Get client's push token from a push_tokens table
  // For MVP, we'll check if client has a stored push token
  const { data: tokenData } = await supabase
    .from("push_tokens")
    .select("expo_token")
    .eq("client_id", request.client_id)
    .single();

  if (!tokenData?.expo_token) {
    return { success: false, error: "No push token for client" };
  }

  const message: ExpoPushMessage = {
    to: tokenData.expo_token,
    title: request.title,
    body: request.body,
    data: request.data,
    sound: "default",
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Expo push error:", errorText);
      return { success: false, error: `Expo API error: ${response.status}` };
    }

    const result = await response.json();

    // Check for Expo-level errors
    if (result.data?.status === "error") {
      return { success: false, error: result.data.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Push send failed:", err);
    return { success: false, error: String(err) };
  }
}
