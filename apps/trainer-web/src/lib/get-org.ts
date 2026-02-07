import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { cache } from "react";

// Cache org lookup per request using React cache
export const getOrg = cache(async () => {
  const supabase = await createClient();

  // Try to get user ID from middleware header first (faster, no auth call)
  const headersList = await headers();
  let userId = headersList.get("x-user-id");
  console.log("getOrg: x-user-id header:", userId);

  // Fallback to auth call if header not present
  if (!userId) {
    const { data: { user }, error } = await supabase.auth.getUser();
    console.log("getOrg: auth.getUser result:", { userId: user?.id, error: error?.message });
    if (!user) return null;
    userId = user.id;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("org_members")
    .select("org_id, orgs(id, name, slug)")
    .eq("user_id", userId)
    .single();

  console.log("getOrg: org_members result:", { membership, error: membershipError?.message });

  if (!membership) return null;

  return {
    orgId: membership.org_id,
    orgName: (membership.orgs as any)?.name || "",
    userId,
  };
});
