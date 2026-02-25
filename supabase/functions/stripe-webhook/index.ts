import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const PLATFORM_FEE_PERCENT = 5;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    await handleEvent(supabase, event);
  } catch (err) {
    console.error("Error handling event:", err);
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleEvent(supabase: ReturnType<typeof createClient>, event: Stripe.Event) {
  const connectedAccountId = event.account;

  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(supabase, event.data.object as Stripe.Account);
      break;

    case "checkout.session.completed":
      await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session, connectedAccountId);
      break;

    case "invoice.paid":
      await handleInvoicePaid(supabase, event.data.object as Stripe.Invoice, connectedAccountId);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(supabase, event.data.object as Stripe.Invoice, connectedAccountId);
      break;

    case "charge.refunded":
      await handleChargeRefunded(supabase, event.data.object as Stripe.Charge, connectedAccountId);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(supabase, event.data.object as Stripe.Subscription, connectedAccountId);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(supabase, event.data.object as Stripe.Subscription, connectedAccountId);
      break;

    case "payout.paid":
      await handlePayoutPaid(supabase, event.data.object as Stripe.Payout, connectedAccountId);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function getOrgIdFromStripeAccount(
  supabase: ReturnType<typeof createClient>,
  stripeAccountId: string | undefined
): Promise<string | null> {
  if (!stripeAccountId) return null;

  const { data } = await supabase
    .from("stripe_accounts")
    .select("org_id")
    .eq("stripe_account_id", stripeAccountId)
    .single();

  return data?.org_id ?? null;
}

async function getClientIdFromStripeCustomer(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  stripeCustomerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("client_id")
    .eq("org_id", orgId)
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  return data?.client_id ?? null;
}

async function handleAccountUpdated(
  supabase: ReturnType<typeof createClient>,
  account: Stripe.Account
) {
  await supabase
    .from("stripe_accounts")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);
}

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) {
    console.error("No org found for connected account:", connectedAccountId);
    return;
  }

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const clientReferenceId = session.client_reference_id;

  if (!clientReferenceId) {
    console.error("No client_reference_id in checkout session");
    return;
  }

  // Upsert subscription record
  await supabase.from("subscriptions").upsert(
    {
      org_id: orgId,
      client_id: clientReferenceId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,client_id" }
  );
}

async function handleInvoicePaid(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  const customerId = invoice.customer as string;
  const clientId = await getClientIdFromStripeCustomer(supabase, orgId, customerId);

  const amountPaid = invoice.amount_paid;
  const stripeFee = Math.round(amountPaid * 0.029 + 30); // Approx Stripe fee: 2.9% + 30c
  const platformFee = Math.round(amountPaid * (PLATFORM_FEE_PERCENT / 100));
  const netAmount = amountPaid - stripeFee - platformFee;

  const eventDate = new Date(invoice.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : Date.now()).toISOString();

  // Insert money events: INCOME, FEE (Stripe), PLATFORM_FEE
  const moneyEvents = [
    {
      org_id: orgId,
      event_date: eventDate,
      type: "INCOME",
      amount_cents: amountPaid,
      currency: invoice.currency,
      tax_cat: "GST", // Assumes Australian GST applies
      tax_cents: Math.round(amountPaid / 11), // GST = 1/11 of total
      source: "stripe",
      reference_id: invoice.id,
      client_id: clientId,
      notes: `Invoice ${invoice.number || invoice.id}`,
    },
    {
      org_id: orgId,
      event_date: eventDate,
      type: "FEE",
      amount_cents: -stripeFee,
      currency: invoice.currency,
      tax_cat: "GST_FREE",
      tax_cents: 0,
      source: "stripe",
      reference_id: invoice.id,
      client_id: clientId,
      notes: "Stripe processing fee",
    },
    {
      org_id: orgId,
      event_date: eventDate,
      type: "PLATFORM_FEE",
      amount_cents: -platformFee,
      currency: invoice.currency,
      tax_cat: "GST",
      tax_cents: Math.round(platformFee / 11),
      source: "stripe",
      reference_id: invoice.id,
      client_id: clientId,
      notes: `Coach OS ${PLATFORM_FEE_PERCENT}% platform fee`,
    },
  ];

  // Idempotency guard: skip insert if this invoice was already processed
  const { data: existing } = await supabase
    .from("money_events")
    .select("id")
    .eq("reference_id", invoice.id)
    .eq("type", "INCOME")
    .maybeSingle();

  if (existing) {
    console.log(`Invoice ${invoice.id} already recorded in money_events — skipping duplicate insert`);
  } else {
    await supabase.from("money_events").insert(moneyEvents);
  }

  // Update subscription status
  if (invoice.subscription) {
    await supabase
      .from("subscriptions")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("stripe_subscription_id", invoice.subscription);
  }
}

async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  if (invoice.subscription) {
    await supabase
      .from("subscriptions")
      .update({ status: "past_due", updated_at: new Date().toISOString() })
      .eq("org_id", orgId)
      .eq("stripe_subscription_id", invoice.subscription);
  }
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: Stripe.Charge,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  const customerId = charge.customer as string;
  const clientId = customerId ? await getClientIdFromStripeCustomer(supabase, orgId, customerId) : null;

  const refundAmount = charge.amount_refunded;

  await supabase.from("money_events").insert({
    org_id: orgId,
    event_date: new Date().toISOString(),
    type: "REFUND",
    amount_cents: -refundAmount,
    currency: charge.currency,
    tax_cat: "GST",
    tax_cents: -Math.round(refundAmount / 11),
    source: "stripe",
    reference_id: charge.id,
    client_id: clientId,
    notes: `Refund for charge ${charge.id}`,
  });
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  let status: string;
  switch (subscription.status) {
    case "active":
    case "trialing":
      status = "active";
      break;
    case "past_due":
    case "unpaid":
      status = "past_due";
      break;
    case "canceled":
    case "incomplete_expired":
      status = "canceled";
      break;
    default:
      status = "none";
  }

  await supabase
    .from("subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("stripe_subscription_id", subscription.id);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("stripe_subscription_id", subscription.id);
}

async function handlePayoutPaid(
  supabase: ReturnType<typeof createClient>,
  payout: Stripe.Payout,
  connectedAccountId?: string
) {
  const orgId = await getOrgIdFromStripeAccount(supabase, connectedAccountId);
  if (!orgId) return;

  await supabase.from("money_events").insert({
    org_id: orgId,
    event_date: new Date(payout.arrival_date * 1000).toISOString(),
    type: "PAYOUT",
    amount_cents: -payout.amount, // Negative = cash out
    currency: payout.currency,
    tax_cat: "NONE",
    tax_cents: 0,
    source: "stripe",
    reference_id: payout.id,
    client_id: null,
    notes: `Payout to bank account`,
  });
}
