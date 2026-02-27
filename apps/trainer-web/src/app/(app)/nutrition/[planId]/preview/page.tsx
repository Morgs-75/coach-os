import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NutritionPlan } from "@/app/(portal)/portal/[token]/NutritionView";
import PreviewClient from "./PreviewClient";

interface PreviewPageProps {
  params: Promise<{ planId: string }>;
}

export default async function NutritionPreviewPage({ params }: PreviewPageProps) {
  const { planId } = await params;
  const supabase = await createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve org membership
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  if (!membership?.org_id) redirect("/login");

  const orgId = membership.org_id;

  // Fetch the plan with full nested structure — same shape as portal page.tsx
  const { data: rawPlan } = await supabase
    .from("meal_plans")
    .select(`
      id, name, start_date, end_date, published_at, version, status, notes,
      client:clients(id, full_name),
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
    .eq("id", planId)
    .eq("org_id", orgId)
    .single();

  if (!rawPlan) notFound();

  // Sort nested data — same as portal page.tsx pattern
  const plan: NutritionPlan = {
    id: rawPlan.id,
    name: rawPlan.name,
    start_date: rawPlan.start_date ?? "",
    end_date: rawPlan.end_date ?? "",
    published_at: rawPlan.published_at ?? new Date().toISOString(),
    version: rawPlan.version ?? undefined,
    notes: (rawPlan as any).notes ?? null,
    days: ((rawPlan.days ?? []) as any[])
      .sort((a: any, b: any) => a.day_number - b.day_number)
      .map((day: any) => ({
        ...day,
        meals: ((day.meals ?? []) as any[])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((meal: any) => ({
            ...meal,
            components: ((meal.components ?? []) as any[]).sort(
              (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
            ),
          })),
      })),
  };

  const clientName: string =
    (rawPlan.client as any)?.full_name ?? "Client";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
          radial-gradient(1200px 800px at 20% 10%, rgba(255,179,74,.14), transparent 60%),
          radial-gradient(1000px 700px at 80% 0%, rgba(59,130,246,.16), transparent 55%),
          radial-gradient(900px 600px at 70% 85%, rgba(74,222,128,.10), transparent 55%),
          linear-gradient(180deg, #07081a, #0b0d24)
        `,
        color: "#eef0ff",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 18px 64px" }}>
        {/* Back link */}
        <div style={{ marginBottom: 18 }}>
          <Link
            href={`/nutrition/${planId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "rgba(238,240,255,0.70)",
              textDecoration: "none",
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to builder
          </Link>
        </div>

        {/* NutritionView — dark theme, coach preview (client wrapper to allow function prop) */}
        <PreviewClient plan={plan} clientName={clientName} />
      </div>
    </div>
  );
}
