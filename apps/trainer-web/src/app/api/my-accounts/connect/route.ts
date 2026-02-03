import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BASIQ_API_URL = "https://au-api.basiq.io";

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

async function getBasiqToken(): Promise<string> {
  const response = await fetch(`${BASIQ_API_URL}/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(process.env.BASIQ_API_KEY + ":").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "basiq-version": "3.0",
    },
    body: "scope=SERVER_ACCESS",
  });

  if (!response.ok) {
    throw new Error("Failed to get Basiq token");
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const orgId = await getOrgId(supabase);

    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from("basiq_connections")
      .select("*")
      .eq("org_id", orgId)
      .single();

    const token = await getBasiqToken();

    let basiqUserId = existingConnection?.basiq_user_id;

    // Create Basiq user if not exists
    if (!basiqUserId) {
      const userResponse = await fetch(`${BASIQ_API_URL}/users`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "basiq-version": "3.0",
        },
        body: JSON.stringify({
          email: user.email,
          mobile: "",
        }),
      });

      if (!userResponse.ok) {
        const error = await userResponse.text();
        console.error("Basiq user creation failed:", error);
        return NextResponse.json({ error: "Failed to create Basiq user" }, { status: 500 });
      }

      const userData = await userResponse.json();
      basiqUserId = userData.id;

      // Store connection
      await supabase.from("basiq_connections").upsert({
        org_id: orgId,
        basiq_user_id: basiqUserId,
        consent_status: "pending",
      });
    }

    // Create consent UI link
    const consentResponse = await fetch(`${BASIQ_API_URL}/users/${basiqUserId}/consents`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "basiq-version": "3.0",
      },
      body: JSON.stringify({
        duration: "ongoing",
        permissions: ["accounts", "transactions"],
      }),
    });

    if (!consentResponse.ok) {
      const error = await consentResponse.text();
      console.error("Basiq consent creation failed:", error);
      return NextResponse.json({ error: "Failed to create consent" }, { status: 500 });
    }

    const consentData = await consentResponse.json();

    // Generate consent UI URL
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/my-accounts/callback`;
    const consentUrl = `https://consent.basiq.io/home?token=${token}&userId=${basiqUserId}&action=connect&redirect_uri=${encodeURIComponent(callbackUrl)}`;

    return NextResponse.json({ consentUrl });
  } catch (error) {
    console.error("Connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
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

    // Update connection status
    await supabase
      .from("basiq_connections")
      .update({ consent_status: "revoked" })
      .eq("org_id", orgId);

    // Deactivate bank accounts
    await supabase
      .from("bank_accounts")
      .update({ is_active: false })
      .eq("org_id", orgId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
