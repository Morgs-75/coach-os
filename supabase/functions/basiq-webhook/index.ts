import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-basiq-signature",
};

interface BasiqWebhookPayload {
  type: string;
  data: {
    userId?: string;
    accountId?: string;
    transactionId?: string;
    connectionId?: string;
    [key: string]: unknown;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get("x-basiq-signature");
    const webhookSecret = Deno.env.get("BASIQ_WEBHOOK_SECRET");

    if (webhookSecret && signature) {
      // In production, verify the signature using HMAC
      // For now, we'll just check if it's present
      console.log("Webhook signature received:", signature.substring(0, 20) + "...");
    }

    const payload: BasiqWebhookPayload = await req.json();
    console.log("Basiq webhook received:", payload.type);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (payload.type) {
      case "transactions.created":
      case "transactions.updated": {
        // New or updated transactions - trigger sync for the org
        const userId = payload.data.userId;
        if (userId) {
          // Find the org with this Basiq user
          const { data: connection } = await supabase
            .from("basiq_connections")
            .select("org_id")
            .eq("basiq_user_id", userId)
            .single();

          if (connection) {
            console.log(`Triggering transaction sync for org: ${connection.org_id}`);
            // In a production system, you might queue this for async processing
            // For now, we'll just mark that a sync is needed
            await supabase
              .from("basiq_connections")
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq("org_id", connection.org_id);
          }
        }
        break;
      }

      case "connection.created":
      case "connection.updated": {
        // Connection status changed
        const userId = payload.data.userId;
        const connectionStatus = payload.data.status as string;

        if (userId) {
          const { data: connection } = await supabase
            .from("basiq_connections")
            .select("org_id")
            .eq("basiq_user_id", userId)
            .single();

          if (connection) {
            // Update connection status
            let consentStatus = "pending";
            if (connectionStatus === "active") {
              consentStatus = "active";
            } else if (connectionStatus === "invalid" || connectionStatus === "revoked") {
              consentStatus = "revoked";
            }

            await supabase
              .from("basiq_connections")
              .update({
                consent_status: consentStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("org_id", connection.org_id);

            console.log(`Updated connection status for org ${connection.org_id}: ${consentStatus}`);
          }
        }
        break;
      }

      case "consent.expired":
      case "consent.revoked": {
        // Consent is no longer valid
        const userId = payload.data.userId;

        if (userId) {
          const { data: connection } = await supabase
            .from("basiq_connections")
            .select("org_id")
            .eq("basiq_user_id", userId)
            .single();

          if (connection) {
            await supabase
              .from("basiq_connections")
              .update({
                consent_status: payload.type === "consent.expired" ? "expired" : "revoked",
                updated_at: new Date().toISOString(),
              })
              .eq("org_id", connection.org_id);

            // Optionally deactivate bank accounts
            await supabase
              .from("bank_accounts")
              .update({ is_active: false })
              .eq("org_id", connection.org_id);

            console.log(`Consent ${payload.type} for org ${connection.org_id}`);
          }
        }
        break;
      }

      case "account.created":
      case "account.updated": {
        // Account information changed
        const userId = payload.data.userId;
        const accountId = payload.data.accountId;
        const accountData = payload.data.account as Record<string, unknown> | undefined;

        if (userId && accountId && accountData) {
          const { data: connection } = await supabase
            .from("basiq_connections")
            .select("org_id")
            .eq("basiq_user_id", userId)
            .single();

          if (connection) {
            // Upsert account
            await supabase.from("bank_accounts").upsert(
              {
                org_id: connection.org_id,
                basiq_account_id: accountId,
                institution_name: (accountData.institution as { name?: string })?.name || "Unknown",
                account_name: (accountData.name as string) || "Account",
                account_number_masked: accountData.accountNo
                  ? `****${(accountData.accountNo as string).slice(-4)}`
                  : null,
                bsb: (accountData.bsb as string) || null,
                account_type: (accountData.class as { type?: string })?.type || null,
                currency: (accountData.currency as string) || "AUD",
                current_balance_cents: Math.round(((accountData.balance as number) || 0) * 100),
                available_balance_cents: Math.round(
                  ((accountData.availableBalance as number) || 0) * 100
                ),
                is_active: accountData.status === "active",
                last_sync_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              { onConflict: "org_id,basiq_account_id" }
            );

            console.log(`Account ${payload.type} for org ${connection.org_id}: ${accountId}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled webhook type: ${payload.type}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
