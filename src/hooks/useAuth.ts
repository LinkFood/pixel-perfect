import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Anonymous sign-in: if no session exists, auto-create one
      // Keep loading=true until anon auth resolves so photo drops aren't lost
      if (!session) {
        try {
          await supabase.auth.signInAnonymously();
        } catch (err) {
          console.error("Anonymous sign-in failed:", err);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAnonymous = user?.is_anonymous ?? false;

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, isAnonymous, signUp, signIn, signOut };
};

export const TOKEN_COSTS = {
  single_illustration: 1,
  short_story: 3,
  picture_book: 5,
} as const;

export type ProductType = keyof typeof TOKEN_COSTS;

export const useCredits = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = async (): Promise<number> => {
    if (!user) return 0;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("user_credits" as any)
        .select("balance")
        .eq("user_id", user.id)
        .single();
      if (error) {
        // A transient network/DB error is NOT "zero credits". Leave the last known
        // balance in place so we never show a false credit gate to a paying user.
        console.error("Failed to fetch credit balance:", error);
        return balance ?? 0;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bal = (data as any)?.balance ?? 0;
      setBalance(bal);
      return bal;
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount when user available
  useEffect(() => {
    if (user) fetchBalance();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { balance, fetchBalance, isLoading };
};
