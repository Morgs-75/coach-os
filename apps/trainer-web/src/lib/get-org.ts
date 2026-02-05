import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { cache } from "react";

// Cache org lookup per request using React cache
export const getOrg = cache(async () => {
  const supabase = await createClient();

  // Try to get user ID from middleware header first (faster, no auth call)
  const headersList = await headers();
  let userId = headersList.get("x-user-id");

  // Fallback to auth call if header not present
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, orgs(id, name, slug)")
    .eq("user_id", userId)
    .single();

  if (!membership) return null;

  return {
    orgId: membership.org_id,
    orgName: (membership.orgs as any)?.name || "",
    userId,
  };
});
