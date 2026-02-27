import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * POST /api/portal/nutrition/feedback
 *
 * Inserts a row into meal_plan_feedback and sends an SMS notification to the
 * coach. Uses service-role client so RLS does not block the portal write.
 *
 * Body:
 *   token       string  — portal_token
 *   plan_id     string  — meal_plans.id
 *   meal_id?    string  — meal_plan_meals.id (nullable — plan-level feedback)
 *   type        'substitution' | 'dislike' | 'allergy' | 'portion' | 'schedule' | 'other'
 *   scope       'this_meal' | 'going_forward' | 'all_occurrences'
 *   comment?    string
 *   forward?    'yes' | 'no' | 'ask_me'
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, plan_id, meal_id, type, scope, comment, forward } = body;

    // Validate required fields
    if (!token || !plan_id || !type || !scope) {
      return NextResponse.json(
        { error: "Missing required fields: token, plan_id, type, scope" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Resolve client from portal token
    const { data: client } = await supabase
      .from("clients")
      .select("id, full_name, org_id")
      .eq("portal_token", token)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Invalid link" }, { status: 401 });
    }

    // Verify plan belongs to this client and is published
    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id, org_id, client_id")
      .eq("id", plan_id)
      .eq("client_id", client.id)
      .eq("status", "published")
      .single();

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or not accessible" },
        { status: 403 }
      );
    }

    // Insert feedback row
    const { data: feedback, error: insertError } = await supabase
      .from("meal_plan_feedback")
      .insert({
        plan_id,
        meal_id: meal_id ?? null,
        client_id: client.id,
        type,
        scope,
        comment: comment ?? null,
        forward: forward ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Feedback insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    // Send Twilio SMS to coach — failure must NOT fail the endpoint
    try {
      const { data: settings } = await supabase
        .from("booking_settings")
        .select("notify_phone")
        .eq("org_id", client.org_id)
        .single();

      const from = process.env.TWILIO_PHONE_NUMBER;
      const coachPhone = settings?.notify_phone;

      if (from && coachPhone) {
        const truncatedComment = comment
          ? ` — ${comment.slice(0, 80)}${comment.length > 80 ? "…" : ""}`
          : "";
        const smsBody = `${client.full_name} submitted nutrition feedback on their meal plan: ${type}${truncatedComment}`;

        await twilioClient.messages.create({
          body: smsBody,
          from,
          to: coachPhone,
        });
      }
    } catch (smsError) {
      console.error("Coach nutrition feedback SMS failed:", smsError);
      // Intentionally not re-throwing — SMS failure does not fail the endpoint
    }

    return NextResponse.json({ success: true, id: feedback?.id }, { status: 201 });
  } catch (error) {
    console.error("Portal nutrition feedback error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
