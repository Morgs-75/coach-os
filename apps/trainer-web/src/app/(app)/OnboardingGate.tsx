"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function OnboardingGate({
  onboardingCompleted,
  children,
}: {
  onboardingCompleted: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!onboardingCompleted && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [onboardingCompleted, pathname, router]);

  // If onboarding not completed, don't show sidebar — render full-screen
  if (!onboardingCompleted) {
    return <>{children}</>;
  }

  return null; // Should not render — parent handles sidebar layout
}
