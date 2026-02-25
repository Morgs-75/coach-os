import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

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

  // Load branding
  const { data: branding } = await supabase
    .from("branding")
    .select("display_name, primary_color")
    .eq("org_id", orgId)
    .single();

  const displayName = branding?.display_name ?? orgName;
  const primaryColor = branding?.primary_color ?? "#0ea5e9";

  // Load upcoming bookings
  const now = new Date().toISOString();
  const { data: upcomingBookings } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, session_type")
    .eq("client_id", client.id)
    .gte("start_time", now)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true })
    .limit(5);

  // Load sessions remaining
  const { data: purchases } = await supabase
    .from("client_purchases")
    .select("sessions_remaining, expires_at")
    .eq("client_id", client.id)
    .eq("payment_status", "succeeded");

  const sessionsRemaining = (purchases ?? []).reduce((sum, p) => {
    if (p.expires_at && new Date(p.expires_at) < new Date()) return sum;
    return sum + (p.sessions_remaining ?? 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: primaryColor }}
            >
              {displayName}
            </p>
            <h1 className="text-lg font-semibold text-gray-900 mt-0.5">
              Hi, {client.full_name.split(" ")[0]}
            </h1>
          </div>
          <span className="text-xs text-gray-400">My Portal</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Sessions remaining banner */}
        <div
          className="rounded-xl p-5 text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <p className="text-sm font-medium opacity-80">Sessions remaining</p>
          <p className="text-4xl font-bold mt-1">{sessionsRemaining}</p>
        </div>

        {/* Upcoming bookings */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Upcoming sessions</h2>
          </div>
          {upcomingBookings && upcomingBookings.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {upcomingBookings.map((booking) => {
                const start = new Date(booking.start_time);
                const end = new Date(booking.end_time);
                return (
                  <li key={booking.id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {start.toLocaleDateString("en-AU", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {start.toLocaleTimeString("en-AU", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                        {" – "}
                        {end.toLocaleTimeString("en-AU", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Confirmed
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No upcoming sessions</p>
              {sessionsRemaining > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  You have {sessionsRemaining} session
                  {sessionsRemaining !== 1 ? "s" : ""} ready to book
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pt-2">
          This is your personal portal link — keep it safe.
        </p>
      </div>
    </div>
  );
}
