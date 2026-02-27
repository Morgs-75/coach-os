"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";
import { ThemeToggle } from "./ThemeToggle";

interface AuditSummary {
  total_issues: number;
  high_severity: number;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: "📊" },
  { name: "AI Coach", href: "/coach", icon: "🧠" },
  { name: "Insights", href: "/insights", icon: "💡" },
  { name: "Calendar", href: "/calendar", icon: "📅" },
  { name: "Clients", href: "/clients", icon: "👥" },
  { name: "Nutrition", href: "/nutrition", icon: "🥗" },
  { name: "Leads", href: "/leads", icon: "📋" },
  { name: "Pricing", href: "/pricing", icon: "💵" },
  { name: "myMarketing", href: "/marketing", icon: "📣" },
  { name: "Email", href: "/email", icon: "📧" },
  { name: "Messages", href: "/messages", icon: "💬" },
  { name: "Automations", href: "/automations", icon: "⚡" },
  { name: "myAccounts", href: "/my-accounts", icon: "💰" },
  { name: "myProducts", href: "/products", icon: "📦" },
  { name: "myExecutiveAssistant", href: "/my-ea", icon: "🤖" },
  { name: "myFitnessMBA", href: "/my-fitness-mba", icon: "🎓" },
];

const settingsNav = [
  { name: "Session Types", href: "/settings/session-types" },
  { name: "SMS & Reminders", href: "/settings/sms" },
  { name: "Account", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    checkPlatformAdmin();
    fetchAuditSummary();
    fetchUnreadCount();
  }, []);

  async function fetchUnreadCount() {
    try {
      const response = await fetch("/api/messages/unread-count");
      if (response.ok) {
        const data = await response.json();
        setUnreadMessages(data.total_unread);
      }
    } catch {
      // Silently fail
    }
  }

  async function fetchAuditSummary() {
    try {
      const response = await fetch("/api/my-accounts/audit");
      if (response.ok) {
        const data = await response.json();
        setAuditSummary(data.summary);
      }
    } catch {
      // Silently fail
    }
  }

  async function checkPlatformAdmin() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("platform_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setIsPlatformAdmin(true);
      }
    } catch {
      // Table may not exist yet - that's fine
    }
  }

  return (
    <aside className="w-64 bg-gray-900 min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">Coach OS</h1>
      </div>
      <nav className="space-y-1 flex-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const isMyAccounts = item.href === "/my-accounts";
          const isMessages = item.href === "/messages";
          const hasIssues = isMyAccounts && auditSummary && auditSummary.total_issues > 0;
          const hasUnread = isMessages && unreadMessages > 0;

          return (
            <div key={item.name}>
              <Link
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
              >
                <span>{item.icon}</span>
                <span className="flex-1">{item.name}</span>
                {hasIssues && (
                  <span className={clsx(
                    "px-1.5 py-0.5 rounded-full text-xs font-medium",
                    auditSummary.high_severity > 0
                      ? "bg-red-500 text-white"
                      : "bg-amber-500 text-white"
                  )}>
                    {auditSummary.total_issues}
                  </span>
                )}
                {hasUnread && (
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
                    {unreadMessages}
                  </span>
                )}
              </Link>
              {/* myAccountant Audit Link */}
              {isMyAccounts && isActive && (
                <Link
                  href="/my-accounts/audit"
                  className={clsx(
                    "flex items-center gap-2 ml-6 px-3 py-1.5 rounded-md text-xs font-medium transition-colors mt-1",
                    pathname === "/my-accounts/audit"
                      ? "text-white bg-gray-700"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  )}
                >
                  <span>🤖</span>
                  myAccountant
                  {hasIssues && (
                    <span className={clsx(
                      "px-1.5 py-0.5 rounded-full text-xs",
                      auditSummary.high_severity > 0
                        ? "bg-red-500 text-white"
                        : "bg-amber-500 text-white"
                    )}>
                      {auditSummary.total_issues}
                    </span>
                  )}
                </Link>
              )}
            </div>
          );
        })}

        {/* Settings Section */}
        <div className="pt-2">
          <div
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-gray-800 text-white"
                : "text-gray-300"
            )}
          >
            <span>⚙️</span>
            Settings
          </div>
          <div className="ml-6 space-y-1 mt-1">
            {settingsNav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={clsx(
                    "block px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    isActive
                      ? "text-white bg-gray-700"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Platform Admin Section */}
      {isPlatformAdmin && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider px-3 mb-2">Platform</p>
          <Link
            href="/admin"
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-purple-900 text-purple-100"
                : "text-purple-300 hover:bg-purple-900/50 hover:text-purple-100"
            )}
          >
            <span>🔒</span>
            Admin Dashboard
          </Link>
        </div>
      )}

      {/* Theme Toggle */}
      <div className="border-t border-gray-700 pt-4 mt-4 px-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
