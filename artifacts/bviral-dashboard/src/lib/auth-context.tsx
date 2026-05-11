import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type AppRole = "admin" | "content_creator";

export interface AuthUser {
  id: string;
  email: string | undefined;
  role: AppRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: AppRole | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchUserRole(session: Session): Promise<AppRole> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3001";

  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      return "content_creator";
    }

    const data = await response.json() as { role?: string };
    return data.role === "admin" ? "admin" : "content_creator";
  } catch {
    return "content_creator";
  }
}

function sessionToAuthUser(session: Session, role: AppRole): AuthUser {
  return {
    id: session.user.id,
    email: session.user.email,
    role,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }

    const role = await fetchUserRole(session);
    setUser(sessionToAuthUser(session, role));
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      resolveSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveSession(session);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      return { error: error.message, role: null };
    }

    // Resolve role immediately so the caller can navigate without waiting for
    // the onAuthStateChange → resolveSession async chain to complete.
    const resolvedRole = data.session ? await fetchUserRole(data.session) : null;
    return { error: null, role: resolvedRole };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, role: user?.role ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}
