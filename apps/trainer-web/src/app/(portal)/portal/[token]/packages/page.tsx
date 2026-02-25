import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import PackagesClient from "./PackagesClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PackagesPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, org_id, orgs(name)")
    .eq("portal_token", token)
    .single();

  if (!client) notFound();

  const [brandingRes, offersRes, stripeRes] = await Promise.all([
    supabase.from("branding").select("display_name, primary_color").eq("org_id", client.org_id).single(),
    supabase
      .from("offers")
      .select("id, name, description, offer_type, price_cents, sessions_included, bonus_sessions, pack_validity_days, is_featured, sort_order")
      .eq("org_id", client.org_id)
      .eq("is_active", true)
      .in("offer_type", ["session_pack", "single_session"])
      .order("sort_order"),
    supabase
      .from("stripe_accounts")
      .select("stripe_account_id, charges_enabled")
      .eq("org_id", client.org_id)
      .single(),
  ]);

  const displayName = brandingRes.data?.display_name ?? (client.orgs as any)?.name ?? "Your Coach";
  const primaryColor = brandingRes.data?.primary_color ?? "#0ea5e9";
  const offers = offersRes.data ?? [];
  const stripeReady = stripeRes.data?.charges_enabled ?? false;

  return (
    <PackagesClient
      token={token}
      displayName={displayName}
      primaryColor={primaryColor}
      offers={offers}
      stripeReady={stripeReady}
    />
  );
}
