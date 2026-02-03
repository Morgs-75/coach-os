import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../src/lib/supabase";
import { useAuth } from "../../src/lib/auth";
import { colors, spacing, fontSize } from "../../src/lib/theme";

interface ClientInfo {
  full_name: string;
  email: string | null;
  subscription_status: string;
  manage_url: string | null;
  org_name: string;
}

export default function AccountScreen() {
  const { clientId, orgId, user, signOut } = useAuth();
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);

  useEffect(() => {
    if (!clientId || !orgId) return;

    async function loadClientInfo() {
      const { data: client } = await supabase
        .from("clients")
        .select("full_name, email")
        .eq("id", clientId)
        .single();

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, manage_url")
        .eq("client_id", clientId)
        .single();

      const { data: org } = await supabase
        .from("orgs")
        .select("name")
        .eq("id", orgId)
        .single();

      const { data: branding } = await supabase
        .from("branding")
        .select("display_name")
        .eq("org_id", orgId)
        .single();

      setClientInfo({
        full_name: client?.full_name ?? "",
        email: client?.email ?? user?.email ?? null,
        subscription_status: subscription?.status ?? "none",
        manage_url: subscription?.manage_url ?? null,
        org_name: branding?.display_name ?? org?.name ?? "",
      });
    }

    loadClientInfo();
  }, [clientId, orgId, user]);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: signOut,
      },
    ]);
  };

  const handleManageBilling = () => {
    if (clientInfo?.manage_url) {
      Linking.openURL(clientInfo.manage_url);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return colors.success;
      case "past_due":
        return colors.error;
      case "canceled":
        return colors.textMuted;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "past_due":
        return "Past Due";
      case "canceled":
        return "Canceled";
      default:
        return "No Subscription";
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {clientInfo?.full_name?.charAt(0).toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{clientInfo?.full_name ?? "Loading..."}</Text>
            <Text style={styles.email}>{clientInfo?.email ?? ""}</Text>
          </View>
        </View>
      </View>

      {/* Organization */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Coach</Text>
        <View style={styles.row}>
          <Ionicons name="business-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.rowText}>{clientInfo?.org_name ?? "Loading..."}</Text>
        </View>
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.row}>
          <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.rowText}>Status</Text>
          <Text
            style={[
              styles.statusBadge,
              { color: getStatusColor(clientInfo?.subscription_status ?? "") },
            ]}
          >
            {getStatusLabel(clientInfo?.subscription_status ?? "")}
          </Text>
        </View>

        {clientInfo?.manage_url && (
          <TouchableOpacity style={styles.manageButton} onPress={handleManageBilling}>
            <Ionicons name="open-outline" size={20} color={colors.primary} />
            <Text style={styles.manageButtonText}>Manage Billing</Text>
          </TouchableOpacity>
        )}

        {clientInfo?.subscription_status === "past_due" && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color={colors.error} />
            <Text style={styles.warningText}>
              Your payment is past due. Please update your payment method to continue.
            </Text>
          </View>
        )}
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.rowText}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: "bold",
    color: "#ffffff",
  },
  profileInfo: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text,
  },
  email: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  statusBadge: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manageButtonText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: "600",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#fef2f2",
    padding: spacing.md,
    borderRadius: 8,
    marginTop: spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.error,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  signOutText: {
    fontSize: fontSize.md,
    color: colors.error,
    fontWeight: "600",
  },
  footer: {
    height: spacing.xl,
  },
});
