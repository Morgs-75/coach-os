import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { supabase } from "../../src/lib/supabase";
import { colors, spacing, fontSize } from "../../src/lib/theme";

export default function InviteScreen() {
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"code" | "signup">("code");
  const [inviteData, setInviteData] = useState<any>(null);
  const router = useRouter();

  async function handleVerifyCode() {
    setError("");
    setLoading(true);

    const { data, error } = await supabase
      .from("client_invites")
      .select("*, clients(full_name), orgs(name)")
      .eq("invite_code", inviteCode.trim())
      .is("redeemed_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      setError("Invalid or expired invite code");
      setLoading(false);
      return;
    }

    setInviteData(data);
    setStep("signup");
    setLoading(false);
  }

  async function handleSignup() {
    setError("");
    setLoading(true);

    // Create account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Failed to create account");
      setLoading(false);
      return;
    }

    // Mark invite as redeemed
    const { error: redeemError } = await supabase
      .from("client_invites")
      .update({
        redeemed_at: new Date().toISOString(),
        redeemed_by: authData.user.id,
      })
      .eq("id", inviteData.id);

    if (redeemError) {
      setError("Failed to redeem invite");
      setLoading(false);
      return;
    }

    // Update client email if not set
    if (inviteData.clients && !inviteData.clients.email) {
      await supabase
        .from("clients")
        .update({ email })
        .eq("id", inviteData.client_id);
    }

    router.replace("/(tabs)/today");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Join Coach OS</Text>

        {step === "code" ? (
          <>
            <Text style={styles.subtitle}>Enter your invite code</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Invite Code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Verifying..." : "Continue"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Welcome, {inviteData?.clients?.full_name}!
            </Text>
            <Text style={styles.orgName}>
              Joining {inviteData?.orgs?.name}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
            />

            <TextInput
              style={styles.input}
              placeholder="Create Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Creating account..." : "Create Account"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: "bold",
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  orgName: {
    fontSize: fontSize.lg,
    color: colors.primary,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: spacing.xl,
  },
  error: {
    backgroundColor: "#fef2f2",
    color: colors.error,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  linkText: {
    color: colors.primary,
    fontSize: fontSize.sm,
  },
});
