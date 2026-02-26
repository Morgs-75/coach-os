import PlanBuilderClient from "./PlanBuilderClient";

export default async function PlanBuilderPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return <PlanBuilderClient planId={planId} />;
}
