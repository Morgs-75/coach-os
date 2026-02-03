import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: rules, error } = await supabase
      .from("coding_rules")
      .select(`
        *,
        account:chart_of_accounts(id, code, name, category)
      `)
      .eq("org_id", orgId)
      .order("priority", { ascending: false });

    if (error) {
      console.error("Coding rules fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }

    return NextResponse.json({
      rules: rules || [],
    });
  } catch (error) {
    console.error("Coding rules fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      name,
      match_description,
      match_merchant,
      match_direction,
      account_id,
      tax_treatment,
      auto_apply,
      is_active,
      priority,
    } = body;

    if (!name || !account_id) {
      return NextResponse.json({ error: "Name and account required" }, { status: 400 });
    }

    // Update existing or create new
    if (id) {
      const { data: updatedRule, error } = await supabase
        .from("coding_rules")
        .update({
          name,
          match_description: match_description || null,
          match_merchant: match_merchant || null,
          match_direction: match_direction || null,
          account_id,
          tax_treatment: tax_treatment || null,
          auto_apply: auto_apply ?? false,
          is_active: is_active ?? true,
          priority: priority ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("org_id", orgId)
        .select()
        .single();

      if (error) {
        console.error("Rule update error:", error);
        return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
      }

      return NextResponse.json({ rule: updatedRule });
    } else {
      const { data: newRule, error } = await supabase
        .from("coding_rules")
        .insert({
          org_id: orgId,
          name,
          match_description: match_description || null,
          match_merchant: match_merchant || null,
          match_direction: match_direction || null,
          account_id,
          tax_treatment: tax_treatment || null,
          auto_apply: auto_apply ?? false,
          is_active: is_active ?? true,
          priority: priority ?? 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Rule creation error:", error);
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
      }

      return NextResponse.json({ rule: newRule });
    }
  } catch (error) {
    console.error("Rule save error:", error);
    return NextResponse.json(
      { error: "Failed to save rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("coding_rules")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      console.error("Rule deletion error:", error);
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rule deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete rule" },
      { status: 500 }
    );
  }
}
