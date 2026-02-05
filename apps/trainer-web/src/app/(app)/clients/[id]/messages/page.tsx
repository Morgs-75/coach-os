"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";

interface Message {
  id: string;
  created_at: string;
  sender_type: "trainer" | "client" | "system";
  body: string;
}

export default function ClientMessagesPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  async function loadData() {
    // Get org_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) return;
    setOrgId(membership.org_id);

    // Get client name
    const { data: client } = await supabase
      .from("clients")
      .select("full_name")
      .eq("id", clientId)
      .single();

    if (client) setClientName(client.full_name);

    // Get or create thread
    let { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("org_id", membership.org_id)
      .eq("client_id", clientId)
      .single();

    if (!thread) {
      const { data: newThread } = await supabase
        .from("message_threads")
        .insert({ org_id: membership.org_id, client_id: clientId })
        .select("id")
        .single();
      thread = newThread;
    }

    if (thread) {
      setThreadId(thread.id);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      setMessages(msgs ?? []);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !threadId || !orgId) return;

    setSending(true);
    await supabase.from("messages").insert({
      org_id: orgId,
      thread_id: threadId,
      sender_type: "trainer",
      body: newMessage.trim(),
    });

    setNewMessage("");
    setSending(false);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <Link href={`/clients/${clientId}`} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          ← Back to {clientName || "Client"}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">Messages with {clientName}</h1>
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No messages yet. Start the conversation!</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={clsx(
                  "max-w-[70%] p-3 rounded-lg",
                  msg.sender_type === "trainer" && "ml-auto bg-brand-500 text-white",
                  msg.sender_type === "client" && "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
                  msg.sender_type === "system" && "mx-auto bg-purple-100 text-purple-700 text-sm"
                )}
              >
                <p>{msg.body}</p>
                <p className={clsx(
                  "text-xs mt-1",
                  msg.sender_type === "trainer" ? "text-brand-100" : "text-gray-400"
                )}>
                  {formatTime(msg.created_at)}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="input flex-1"
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!newMessage.trim() || sending}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
