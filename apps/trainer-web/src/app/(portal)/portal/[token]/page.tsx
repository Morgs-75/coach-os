import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import PortalDashboard from "./PortalDashboard";

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Resolve client from token
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, org_id, orgs(name)")
    .eq("portal_token", token)
    .single();

  if (!client) notFound();

  const orgId = client.org_id;
  const orgName = (client.orgs as any)?.name ?? "Your Coach";

  // Run all data fetches in parallel
  const now = new Date().toISOString();
  const [brandingRes, upcomingRes, pastRes, purchasesRes, settingsRes] = await Promise.all([
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
      .select("sessions_remaining, expires_at")
      .eq("client_id", client.id)
      .eq("payment_status", "succeeded"),
    supabase
      .from("booking_settings")
      .select("cancel_notice_hours, allow_client_cancel")
      .eq("org_id", orgId)
      .single(),
  ]);

  const displayName = brandingRes.data?.display_name ?? orgName;
  const primaryColor = brandingRes.data?.primary_color ?? "#0ea5e9";

  const sessionsRemaining = (purchasesRes.data ?? []).reduce((sum, p) => {
    if (p.expires_at && new Date(p.expires_at) < new Date()) return sum;
    return sum + (p.sessions_remaining ?? 0);
  }, 0);

  const cancelNoticeHours = settingsRes.data?.cancel_notice_hours ?? 24;

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
    />
  );
}
