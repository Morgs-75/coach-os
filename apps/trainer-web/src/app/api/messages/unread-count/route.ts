import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrg } from "@/lib/get-org";

export async function GET() {
  try {
    const org = await getOrg();
    if (!org) {
      return NextResponse.json({ total_unread: 0 });
    }

    const supabase = await createClient();

    // Get all threads for this org with their last read timestamp
    const { data: threads, error: threadsError } = await supabase
      .from("message_threads")
      .select("id, trainer_last_read_at")
      .eq("org_id", org.orgId);

    if (threadsError || !threads || threads.length === 0) {
      return NextResponse.json({ total_unread: 0 });
    }

    let totalUnread = 0;

    // For each thread, count unread client messages
    for (const thread of threads) {
      let query = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id)
        .eq("sender_type", "client");

      if (thread.trainer_last_read_at) {
        query = query.gt("created_at", thread.trainer_last_read_at);
      }

      const { count } = await query;
      totalUnread += count ?? 0;
    }

    return NextResponse.json({ total_unread: totalUnread });
  } catch (error) {
    console.error("Unread count error:", error);
    return NextResponse.json({ total_unread: 0 });
  }
}
