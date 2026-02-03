import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { client_id, client_name } = await request.json();

    const apiKey = process.env.DAILY_API_KEY;
    const domain = process.env.NEXT_PUBLIC_DAILY_DOMAIN;

    if (!apiKey || !domain) {
      return NextResponse.json(
        { error: "Daily.co not configured" },
        { status: 500 }
      );
    }

    // Generate a unique room name
    const roomName = `session-${client_id?.slice(0, 8) || "guest"}-${Date.now()}`;

    // Create room via Daily.co API
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          // Room expires after 1 hour
          exp: Math.floor(Date.now() / 1000) + 3600,
          // Enable recording (optional, requires paid plan)
          // enable_recording: "cloud",
          // Enable chat
          enable_chat: true,
          // Enable screen sharing
          enable_screenshare: true,
          // Start with video on
          start_video_off: false,
          // Start with audio on
          start_audio_off: false,
          // Max participants (1-on-1 coaching)
          max_participants: 4,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Daily.co API error:", errorData);
      return NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
      );
    }

    const roomData = await response.json();

    return NextResponse.json({
      room_url: roomData.url,
      room_name: roomData.name,
      expires_at: new Date((roomData.config?.exp || 0) * 1000).toISOString(),
    });
  } catch (error) {
    console.error("Error creating video room:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
