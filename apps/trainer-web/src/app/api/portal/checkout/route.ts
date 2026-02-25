import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/portal/checkout
 * Body: { token, offer_id }
 *
 * Validates token → fetches offer → creates Stripe Checkout session via Connect.
 * Returns { url } — client redirects to Stripe-hosted payment page.
 * On success Stripe calls the webhook which creates client_purchases.
 */
export async function POST(request: Request) {
  try {
    const { token, offer_id } = await request.json();

    if (!token || !offer_id) {
      return NextResponse.json({ error: "Missing token or offer_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Resolve client from token
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, phone, org_id")
      .eq("portal_token", token)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Invalid link" }, { status: 401 });
    }

    // Fetch the offer — must be active and belong to this org
    const { data: offer } = await supabase
      .from("offers")
      .select("id, name, description, offer_type, price_cents, currency, sessions_included, bonus_sessions, pack_validity_days")
      .eq("id", offer_id)
      .eq("org_id", client.org_id)
      .eq("is_active", true)
      .single();

    if (!offer) {
      return NextResponse.json({ error: "Offer not found or unavailable" }, { status: 404 });
    }

    if (!["session_pack", "single_session"].includes(offer.offer_type)) {
      return NextResponse.json({ error: "This offer type cannot be purchased via the portal" }, { status: 400 });
    }

    // Get connected Stripe account for this org
    const { data: stripeAccount } = await supabase
      .from("stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("org_id", client.org_id)
      .single();

    if (!stripeAccount?.charges_enabled) {
      return NextResponse.json(
        { error: "Online payments are not available for this coach. Please contact them directly." },
        { status: 503 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const currency = offer.currency ?? "aud";
    const platformFee = Math.round(offer.price_cents * 0.05);

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: offer.name,
                description: offer.description ?? undefined,
              },
              unit_amount: offer.price_cents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: platformFee,
          metadata: {
            offer_id: offer.id,
            client_id: client.id,
            org_id: client.org_id,
            portal_token: token,
          },
        },
        metadata: {
          offer_id: offer.id,
          client_id: client.id,
          org_id: client.org_id,
          portal_token: token,
        },
        success_url: `${appUrl}/portal/${token}?purchased=1`,
        cancel_url: `${appUrl}/portal/${token}/packages`,
      },
      {
        stripeAccount: stripeAccount.stripe_account_id,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Portal checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
