"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
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

  return (
    <div className="card p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Coach OS</h1>
        <p className="text-gray-500 mt-2">Create your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">
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
          <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
