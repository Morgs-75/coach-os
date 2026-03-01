import { createClient } from "@/lib/supabase/server";
import { RiskBadge } from "@/components/RiskBadge";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import type { RiskTier, SubscriptionStatus } from "@/types";
import { clsx } from "clsx";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();

  return membership?.org_id ?? null;
}

const statusColors: Record<string, string> = {
  active: "text-green-600",
  past_due: "text-red-600",
  canceled: "text-gray-500",
  none: "text-gray-400",
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const orgId = await getOrgId(supabase);

  if (!orgId) {
    return <div>No organization found</div>;
  }

  const today = new Date().toISOString().split("T")[0];

  // Get clients with risk and subscription data
  const { data: clients } = await supabase
    .from("clients")
    .select(`
      id,
      full_name,
      email,
      status,
      created_at,
      subscriptions(status),
      client_risk(tier, score)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  // Get today's risk scores
  const { data: riskScores } = await supabase
    .from("client_risk")
    .select("client_id, tier, score")
    .eq("org_id", orgId)
    .eq("as_of_date", today);

  const riskMap = new Map(riskScores?.map((r) => [r.client_id, r]) ?? []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
        <Link href="/clients/new" className="btn-primary">
          Add Client
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Risk
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Subscription
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {clients?.map((client: any) => {
              const risk = riskMap.get(client.id);
              const subscription = client.subscriptions?.[0];
              const subStatus = subscription?.status ?? "none";

              return (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/clients/${client.id}`}
                      className="block"
                    >
                      <p className="font-medium text-gray-900 dark:text-gray-100 hover:text-brand-600">
                        {client.full_name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <RiskBadge tier={risk?.tier as RiskTier} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={clsx("text-sm font-medium capitalize", statusColors[subStatus])}>
                      {subStatus.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(client.created_at)}
                  </td>
                </tr>
              );
            })}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center">
                  <p className="text-3xl mb-3">👥</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">No clients yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your first client to start managing your business.</p>
                  <Link href="/clients/new" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
                    + Add Client
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
