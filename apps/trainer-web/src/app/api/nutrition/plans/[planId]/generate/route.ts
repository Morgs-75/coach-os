import { NextResponse } from "next/server";

// This endpoint has been split into three sub-routes:
//   POST .../generate/start  — sets status='generating', returns immediately
//   POST .../generate/run    — runs AI generation (fire-and-forget from client)
//   GET  .../generate/status — polling endpoint
// This file is kept as a stub to prevent 404 on any stale client calls.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been replaced. Use /generate/start, /generate/run, and /generate/status." },
    { status: 410 }
  );
}
