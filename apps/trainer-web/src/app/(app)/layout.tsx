import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";
import { OnboardingGate } from "./OnboardingGate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let onboardingCompleted = true;

  const org = await getOrg();
  if (org) {
    const supabase = await createClient();
    const { data: orgData } = await supabase
      .from("orgs")
      .select("onboarding_completed")
      .eq("id", org.orgId)
      .single();

    onboardingCompleted = orgData?.onboarding_completed ?? true;
  }

  // If onboarding not completed, show full-screen (no sidebar)
  if (!onboardingCompleted) {
    return (
      <OnboardingGate onboardingCompleted={false}>
        {children}
      </OnboardingGate>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
