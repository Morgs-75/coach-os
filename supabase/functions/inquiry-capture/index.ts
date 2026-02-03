import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface InquiryPayload {
  org_slug: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
  source?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: InquiryPayload = await req.json();

    // Validate required fields
    if (!payload.org_slug || !payload.name) {
      return new Response(
        JSON.stringify({ error: "org_slug and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up org by slug
    const { data: org, error: orgError } = await supabase
      .from("orgs")
      .select("id")
      .eq("slug", payload.org_slug)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing inquiry with same email (optional dedupe)
    if (payload.email) {
      const { data: existing } = await supabase
        .from("inquiries")
        .select("id, status")
        .eq("org_id", org.id)
        .eq("email", payload.email)
        .in("status", ["NEW", "CONTACTED", "BOOKED"])
        .single();

      if (existing) {
        // Return existing inquiry ID instead of creating duplicate
        return new Response(
          JSON.stringify({
            success: true,
            inquiry_id: existing.id,
            message: "Existing inquiry found",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create new inquiry
    const { data: inquiry, error: insertError } = await supabase
      .from("inquiries")
      .insert({
        org_id: org.id,
        name: payload.name,
        email: payload.email || null,
        phone: payload.phone || null,
        message: payload.message || null,
        source: payload.source || "website",
        status: "NEW",
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        inquiry_id: inquiry.id,
        message: "Inquiry submitted successfully",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Inquiry capture failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to process inquiry" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
