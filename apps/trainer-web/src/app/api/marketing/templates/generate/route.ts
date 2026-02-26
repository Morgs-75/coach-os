import { NextResponse } from "next/server";
import { getOrg } from "@/lib/get-org";

export async function POST(request: Request) {
  try {
    const org = await getOrg();
    if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, description } = await request.json() as {
      name: string;
      description?: string;
    };

    if (!name?.trim()) return NextResponse.json({ error: "Template name required" }, { status: 400 });

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const context = description?.trim()
      ? `Template purpose: ${description.trim()}`
      : `Template name: "${name.trim()}" — infer the purpose from the name.`;

    const prompt = `You are writing an SMS marketing message for a personal trainer or fitness coach to send to their clients.

${context}

Write a concise, friendly, and motivational SMS message body. Requirements:
- Use {name} as a placeholder for the recipient's first name
- Use {coach_name} for the coach's name where natural (e.g. signing off)
- Use {portal_link} where the client's personal booking portal URL should appear — ONLY if the template is about booking, scheduling, or account access. Leave it out otherwise.
- Use {offers} where the offer list should appear — ONLY if the template is explicitly about promotions, deals, or pricing. Leave it out otherwise. Do NOT include {offers} in booking reminder templates.
- Keep it to 1-2 SMS segments (under 306 characters total, ideally under 160)
- Friendly, motivational tone — not spammy
- End with: "Reply STOP to opt out."
- Return ONLY the message body text, nothing else — no labels, no quotes, no explanation

Message:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await response.json();
    const body = data.content?.[0]?.text?.trim();

    if (!body) return NextResponse.json({ error: "Empty response from AI" }, { status: 500 });

    return NextResponse.json({ body });
  } catch (err) {
    console.error("Template generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
