import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";

export async function GET() {
  try {
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("sms_templates")
      .select("id, name, description, body, template_key, created_at")
      .eq("org_id", org.orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, body, description } = await request.json() as {
      name: string;
      body: string;
      description?: string;
    };

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!body?.trim()) return NextResponse.json({ error: "Body is required" }, { status: 400 });

    // Slug the name into a template_key
    const template_key = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const supabase = await createClient();

    // Deactivate any existing template with the same key so we can reuse it
    await supabase
      .from("sms_templates")
      .update({ is_active: false })
      .eq("org_id", org.orgId)
      .eq("template_key", template_key);

    const { data, error } = await supabase
      .from("sms_templates")
      .insert({
        org_id: org.orgId,
        template_key,
        name: name.trim(),
        description: description?.trim() || null,
        body: body.trim(),
        is_active: true,
      })
      .select("id, name, description, body, template_key, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from("sms_templates")
      .update({ is_active: false })
      .eq("id", id)
      .eq("org_id", org.orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
