"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (password.length === 0) return { label: "", color: "bg-gray-200", width: "0%" };
  if (password.length < 8) return { label: "Too short", color: "bg-red-500", width: "25%" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { label: "Weak", color: "bg-red-500", width: "33%" };
  if (score <= 3) return { label: "Fair", color: "bg-amber-500", width: "66%" };
  return { label: "Strong", color: "bg-green-500", width: "100%" };
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreedTerms) {
      setError("Please accept the terms and conditions to continue.");
      return;
    }

    setLoading(true);

    // Sign up user
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

    // Check if email confirmation is required
    if (authData.user.identities?.length === 0) {
      setError("An account with this email already exists.");
      setLoading(false);
      return;
    }

    // If email confirmation is pending (user created but not confirmed)
    if (!authData.session) {
      setVerifying(true);
      setLoading(false);
      return;
    }

    // Create org
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: org, error: orgError } = await supabase
      .from("orgs")
      .insert({ name: businessName, slug })
      .select()
      .single();

    if (orgError) {
      setError("Failed to create organization");
      setLoading(false);
      return;
    }

    // Add user as owner
    const { error: memberError } = await supabase.from("org_members").insert({
      org_id: org.id,
      user_id: authData.user.id,
      role: "owner",
    });

    if (memberError) {
      setError("Failed to set up organization");
      setLoading(false);
      return;
    }

    // Create default branding
    await supabase.from("branding").insert({
      org_id: org.id,
      display_name: businessName,
    });

    router.push("/dashboard");
    router.refresh();
  }

  if (verifying) {
    return (
      <div className="card p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Check your email</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-1">
            We&apos;ve sent a verification link to
          </p>
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-4">{email}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Click the link in the email to verify your account and get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Coach OS</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="businessName" className="label">
            Business Name
          </label>
          <input
            id="businessName"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="input"
            placeholder="Your Fitness Coaching"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            minLength={8}
            required
          />
          {/* Password strength indicator */}
          {password.length > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={clsx("h-full rounded-full transition-all duration-300", strength.color)}
                  style={{ width: strength.width }}
                />
              </div>
              <p className={clsx("text-xs mt-1", {
                "text-red-500": strength.label === "Too short" || strength.label === "Weak",
                "text-amber-500": strength.label === "Fair",
                "text-green-500": strength.label === "Strong",
              })}>
                {strength.label}
              </p>
            </div>
          )}
          {!password && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Minimum 8 characters</p>}
        </div>

        {/* Terms checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the Terms of Service and Privacy Policy
          </span>
        </label>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
