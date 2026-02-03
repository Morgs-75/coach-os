import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, fontSize } from "../../src/lib/theme";

interface Message {
  id: string;
  created_at: string;
  sender_type: "trainer" | "client" | "system";
  body: string;
}

export default function MessagesScreen() {
  const { clientId, orgId } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async () => {
    if (!clientId || !orgId) return;

    // Get or create thread
    let { data: thread } = await supabase
      .from("message_threads")
      .select("id")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .single();

    if (!thread) {
      const { data: newThread } = await supabase
        .from("message_threads")
        .insert({ org_id: orgId, client_id: clientId })
        .select("id")
        .single();
      thread = newThread;
    }

    if (thread) {
      setThreadId(thread.id);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, created_at, sender_type, body")
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: true });

      setMessages(msgs ?? []);
    }
  }, [clientId, orgId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Subscribe to new messages
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
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !threadId || !orgId) return;

    setSending(true);
    const { error } = await supabase.from("messages").insert({
      org_id: orgId,
      thread_id: threadId,
      sender_type: "client",
      body: newMessage.trim(),
    });

    if (!error) {
      setNewMessage("");
    }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isClient = item.sender_type === "client";
    const isSystem = item.sender_type === "system";

    return (
      <View
        style={[
          styles.messageBubble,
          isClient && styles.clientBubble,
          isSystem && styles.systemBubble,
        ]}
      >
        {isSystem && (
          <Text style={styles.systemLabel}>System</Text>
        )}
        <Text style={[styles.messageText, isClient && styles.clientText]}>
          {item.body}
        </Text>
        <Text
          style={[styles.messageTime, isClient && styles.clientTime]}
        >
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Send a message to your coach
            </Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={1000}
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Ionicons
            name="send"
            size={20}
            color={newMessage.trim() ? "#ffffff" : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  messageList: {
    padding: spacing.md,
    flexGrow: 1,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  systemBubble: {
    alignSelf: "center",
    backgroundColor: "#f3e8ff",
    borderColor: "#e9d5ff",
  },
  systemLabel: {
    fontSize: fontSize.xs,
    color: "#7c3aed",
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  messageText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 22,
  },
  clientText: {
    color: "#ffffff",
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  clientTime: {
    color: "rgba(255,255,255,0.7)",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  inputContainer: {
    flexDirection: "row",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    maxHeight: 100,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
