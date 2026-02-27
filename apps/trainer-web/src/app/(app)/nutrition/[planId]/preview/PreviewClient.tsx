"use client";

import NutritionView, { NutritionPlan } from "@/app/(portal)/portal/[token]/NutritionView";

interface PreviewClientProps {
  plan: NutritionPlan;
  clientName: string;
}

export default function PreviewClient({ plan, clientName }: PreviewClientProps) {
  // No-op feedback in preview — coach is read-only
  function handleFeedback() {
    // intentionally empty — preview is read-only
  }

  return (
    <NutritionView
      plan={plan}
      token=""
      primaryColor="#ffb34a"
      onFeedback={handleFeedback}
      clientName={clientName}
    />
  );
}
