import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

// Cache org lookup per request using React cache
export const getOrg = cache(async () => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id, orgs(id, name, slug)")
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  return {
    orgId: membership.org_id,
    orgName: (membership.orgs as any)?.name || "",
    userId: user.id,
  };
});
