import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  return membership?.org_id ?? null;
}

interface VersionSummary {
  id: string;
  version: number;
  status: "draft" | "published";
  published_at: string | null;
  parent_plan_id: string | null;
}

/**
 * GET /api/nutrition/plans/[planId]/versions
 *
 * Returns all plans in the same version chain as planId.
 * Uses iterative root-finding to walk up parent_plan_id chain, then
 * BFS downward to collect all versions regardless of depth.
 *
 * Response: { versions: VersionSummary[] } sorted by version ASC
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Iterative root-finding — walk parent_plan_id until we reach
    // a plan with parent_plan_id = null (the root of the version chain).
    const MAX_DEPTH = 50; // safety cap against corrupt data cycles
    let rootId = planId;
    let currentId = planId;

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const { data: current } = await supabase
        .from("meal_plans")
        .select("id, parent_plan_id")
        .eq("id", currentId)
        .eq("org_id", orgId)
        .single();

      if (!current) {
        // Plan not found or not in this org — return empty
        return NextResponse.json({ versions: [] });
      }

      const planRow = current as { id: string; parent_plan_id: string | null };

      if (!planRow.parent_plan_id) {
        rootId = planRow.id; // this IS the root
        break;
      }

      // Walk up
      currentId = planRow.parent_plan_id;
      rootId = currentId; // update in case we hit MAX_DEPTH
    }

    // Step 2: BFS downward from rootId to collect all versions.
    // Handles arbitrary chain depth (v1 → v2 → v3 → ... at any nesting).
    const allVersions: VersionSummary[] = [];
    const seen = new Set<string>();
    let frontier = [rootId];

    while (frontier.length > 0) {
      // Fetch: plans whose id is in frontier (root + already seen) OR whose
      // parent_plan_id is in the current frontier (direct children).
      const { data: batch } = await supabase
        .from("meal_plans")
        .select("id, version, status, published_at, parent_plan_id")
        .or(
          `id.in.(${frontier.join(",")}),parent_plan_id.in.(${frontier.join(",")})`
        )
        .eq("org_id", orgId)
        .order("version", { ascending: true });

      const nextFrontier: string[] = [];

      for (const row of batch ?? []) {
        const r = row as VersionSummary;
        if (!seen.has(r.id)) {
          seen.add(r.id);
          allVersions.push(r);
          // Follow children in next round
          nextFrontier.push(r.id);
        }
      }

      // Only continue with newly discovered nodes to avoid infinite loops
      frontier = nextFrontier.filter((id) => !seen.has(id) || frontier.includes(id));

      // Break if no new nodes were discovered this round
      const newNodes = nextFrontier.filter((id) => allVersions.find((v) => v.id === id));
      if (newNodes.length === 0 && frontier.every((id) => seen.has(id))) {
        break;
      }

      // Safety: if frontier hasn't changed (no new unseen IDs), stop
      const unseenFrontier = nextFrontier.filter((id) => {
        // id was added this round — it's "seen" but we track it to expand children next
        return allVersions.find((v) => v.id === id);
      });
      if (unseenFrontier.length === 0) break;

      // Next round: expand children of nodes we just discovered
      frontier = unseenFrontier;
    }

    // Sort by version number ascending
    allVersions.sort((a, b) => a.version - b.version);

    return NextResponse.json({ versions: allVersions });
  } catch (error) {
    console.error("Versions fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch versions", details: String(error) },
      { status: 500 }
    );
  }
}
