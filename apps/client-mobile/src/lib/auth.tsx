import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { registerForPushNotifications } from "./notifications";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  clientId: string | null;
  orgId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  clientId: null,
  orgId: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchClientInfo(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchClientInfo(session.user.id);
      } else {
        setClientId(null);
        setOrgId(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchClientInfo(userId: string) {
    // Client's user_id is stored when they redeem an invite
    const { data: invite } = await supabase
      .from("client_invites")
      .select("client_id, org_id")
      .eq("redeemed_by", userId)
      .single();

    if (invite) {
      setClientId(invite.client_id);
      setOrgId(invite.org_id);
      // Register for push notifications after we know the client
      registerForPushNotifications(invite.client_id, invite.org_id).catch(
        (err) => console.warn("Push registration failed:", err)
      );
    }
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setClientId(null);
    setOrgId(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        clientId,
        orgId,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
