import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import PortalDashboard from "./PortalDashboard";
import { NutritionPlan } from "./NutritionView";

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Resolve client from token
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, org_id, orgs!clients_org_id_fkey(name)")
    .eq("portal_token", token)
    .single();

  if (!client) notFound();

  const orgId = client.org_id;
  const orgName = (client.orgs as any)?.name ?? "Your Coach";

  // Run all data fetches in parallel
  const now = new Date().toISOString();
  const [brandingRes, upcomingRes, pastRes, purchasesRes, settingsRes, planRes] = await Promise.all([
    supabase.from("branding").select("display_name, primary_color").eq("org_id", orgId).single(),
    supabase
      .from("bookings")
      .select("id, start_time, end_time, status")
      .eq("client_id", client.id)
      .gte("start_time", now)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true })
      .limit(10),
    supabase
      .from("bookings")
      .select("id, start_time, end_time, status")
      .eq("client_id", client.id)
      .lt("start_time", now)
      .order("start_time", { ascending: false })
      .limit(10),
    supabase
      .from("client_purchases")
      .select("id, sessions_total, sessions_remaining, expires_at, offer_id(name)")
      .eq("client_id", client.id)
      .eq("payment_status", "succeeded"),
    supabase
      .from("booking_settings")
      .select("cancel_notice_hours, allow_client_cancel")
      .eq("org_id", orgId)
      .single(),
    supabase
      .from("meal_plans")
      .select(`
        id, name, start_date, end_date, published_at, version, notes,
        days:meal_plan_days(
          id, day_number, date,
          meals:meal_plan_meals(
            id, meal_type, title, sort_order,
            components:meal_plan_components(
              id, qty_g, custom_name, sort_order,
              food_item:food_items(id, food_name, energy_kcal, protein_g, fat_g, carb_g)
            )
          )
        )
      `)
      .eq("client_id", client.id)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const displayName = brandingRes.data?.display_name ?? orgName;
  const primaryColor = brandingRes.data?.primary_color ?? "#0ea5e9";

  // Filter active (non-expired) purchases and enrich with bookable_remaining
  const activePurchases = (purchasesRes.data ?? []).filter(
    (p: any) => !p.expires_at || new Date(p.expires_at) >= new Date()
  );

  const enrichedPurchases = await Promise.all(
    activePurchases.map(async (p: any) => {
      const { data: bookable } = await supabase.rpc("bookable_sessions_remaining", {
        p_purchase_id: p.id,
      });
      return { ...p, bookable_remaining: bookable ?? 0 };
    })
  );

  const sessionsRemaining = enrichedPurchases.reduce(
    (sum: number, p: any) => sum + (p.bookable_remaining ?? 0),
    0
  );

  const cancelNoticeHours = settingsRes.data?.cancel_notice_hours ?? 24;

  // Sort nested plan data
  let mealPlan: NutritionPlan | null = null;
  if (planRes.data) {
    const raw = planRes.data as any;
    mealPlan = {
      ...raw,
      days: (raw.days ?? [])
        .sort((a: any, b: any) => a.day_number - b.day_number)
        .map((day: any) => ({
          ...day,
          meals: (day.meals ?? [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((meal: any) => ({
              ...meal,
              components: (meal.components ?? []).sort(
                (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
              ),
            })),
        })),
    };
  }

  return (
    <PortalDashboard
      token={token}
      clientName={client.full_name}
      displayName={displayName}
      primaryColor={primaryColor}
      sessionsRemaining={sessionsRemaining}
      cancelNoticeHours={cancelNoticeHours}
      upcomingBookings={upcomingRes.data ?? []}
      pastBookings={pastRes.data ?? []}
      mealPlan={mealPlan}
      activePurchases={enrichedPurchases}
    />
  );
}
