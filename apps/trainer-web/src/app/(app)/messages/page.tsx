"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { clsx } from "clsx";

interface ThreadWithDetails {
  id: string;
  client_id: string;
  trainer_last_read_at: string | null;
  client_name: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_type: string | null;
  unread_count: number;
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<ThreadWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadThreads();
  }, []);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel("messages-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          // Refresh the thread list when any new message arrives
          loadThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  async function loadThreads() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    // Get all threads with client names
    const { data: threadData } = await supabase
      .from("message_threads")
      .select("id, client_id, trainer_last_read_at, clients(full_name)")
      .eq("org_id", membership.org_id);

    if (!threadData || threadData.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    // For each thread, get the last message and unread count
    const enriched: ThreadWithDetails[] = await Promise.all(
      threadData.map(async (thread: any) => {
        // Last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("body, created_at, sender_type")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Unread count (client messages after trainer_last_read_at)
        let unreadQuery = supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", thread.id)
          .eq("sender_type", "client");

        if (thread.trainer_last_read_at) {
          unreadQuery = unreadQuery.gt("created_at", thread.trainer_last_read_at);
        }

        const { count } = await unreadQuery;

        return {
          id: thread.id,
          client_id: thread.client_id,
          trainer_last_read_at: thread.trainer_last_read_at,
          client_name: thread.clients?.full_name || "Unknown Client",
          last_message: lastMsg?.body || null,
          last_message_at: lastMsg?.created_at || null,
          last_sender_type: lastMsg?.sender_type || null,
          unread_count: count ?? 0,
        };
      })
    );

    // Sort by most recent message, threads with messages first
    enriched.sort((a, b) => {
      if (!a.last_message_at && !b.last_message_at) return 0;
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setThreads(enriched);
    setLoading(false);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-AU", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Messages</h1>

      {threads.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-3xl mb-3">💬</p>
          <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">No conversations yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Start a conversation from a client&apos;s profile page.
          </p>
          <a href="/clients" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            View Clients
          </a>
        </div>
      ) : (
        <div className="card divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/clients/${thread.client_id}/messages`}
              className={clsx(
                "flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                thread.unread_count > 0 && "bg-brand-50 dark:bg-brand-900/10"
              )}
            >
              {/* Avatar */}
              <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0",
                thread.unread_count > 0 ? "bg-brand-500" : "bg-gray-400 dark:bg-gray-600"
              )}>
                {thread.client_name.charAt(0).toUpperCase()}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={clsx(
                    "text-sm truncate",
                    thread.unread_count > 0
                      ? "font-semibold text-gray-900 dark:text-gray-100"
                      : "font-medium text-gray-700 dark:text-gray-300"
                  )}>
                    {thread.client_name}
                  </span>
                  {thread.last_message_at && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                      {formatTime(thread.last_message_at)}
                    </span>
                  )}
                </div>
                {thread.last_message && (
                  <p className={clsx(
                    "text-sm truncate mt-0.5",
                    thread.unread_count > 0
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-500 dark:text-gray-400"
                  )}>
                    {thread.last_sender_type === "trainer" && (
                      <span className="text-gray-400 dark:text-gray-500">You: </span>
                    )}
                    {thread.last_message}
                  </p>
                )}
              </div>

              {/* Unread badge */}
              {thread.unread_count > 0 && (
                <span className="bg-brand-500 text-white text-xs font-medium rounded-full px-2 py-0.5 flex-shrink-0">
                  {thread.unread_count}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
