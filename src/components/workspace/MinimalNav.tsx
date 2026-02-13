import { LogOut, Coins, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { isDevMode, disableDevMode } from "@/lib/devMode";

interface MinimalNavProps {
  showAuth?: boolean;
}

const MinimalNav = ({ showAuth = true }: MinimalNavProps) => {
  const { user, loading, signOut } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setCredits(null); return; }
    supabase
      .from("user_credits" as any)
      .select("balance")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setCredits((data as any)?.balance ?? 0);
      });
  }, [user]);

  return (
    <nav className="flex items-center justify-between px-6 lg:px-12 h-14 shrink-0 border-b border-border/50">
      <a
        href="/"
        className="font-display text-lg font-semibold tracking-tight text-foreground"
      >
        PhotoRabbit
      </a>

      <div className="flex items-center gap-4">
        {isDevMode() && (
          <button
            onClick={async () => {
              disableDevMode();
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors text-muted-foreground border border-border hover:bg-secondary"
          >
            <X className="w-3 h-3" />
            Exit Dev
          </button>
        )}
        {!loading && user && showAuth ? (
          <>
            {credits !== null && (
              <div className="flex items-center gap-1.5 font-body text-sm">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{credits}</span>
              </div>
            )}
            <button
              onClick={signOut}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : null}
      </div>
    </nav>
  );
};

export default MinimalNav;
