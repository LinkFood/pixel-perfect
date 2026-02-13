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
    <nav className="flex items-center justify-between px-6 lg:px-12 h-14 shrink-0">
      <a
        href="/"
        className="font-display text-lg font-semibold tracking-tight"
        style={{ color: "#2C2417" }}
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
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition-colors hover:bg-black/5"
            style={{ color: "#9B8E7F", borderColor: "#D5C8B8", border: "1px solid" }}
          >
            <X className="w-3 h-3" />
            Exit Dev
          </button>
        )}
        {!loading && user && showAuth ? (
          <>
            {credits !== null && (
              <div className="flex items-center gap-1.5 font-body text-sm" style={{ color: "#6B5D4F" }}>
                <Coins className="w-4 h-4" style={{ color: "#C4956A" }} />
                <span className="font-semibold" style={{ color: "#2C2417" }}>{credits}</span>
              </div>
            )}
            <a
              href="/dashboard"
              className="font-body text-sm transition-colors hover:text-foreground"
              style={{ color: "#6B5D4F" }}
            >
              My Books
            </a>
            <button
              onClick={signOut}
              className="transition-colors hover:text-foreground"
              style={{ color: "#9B8E7F" }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : !loading && !user && showAuth ? (
          <>
            <a
              href="#pricing"
              className="hidden sm:block font-body text-sm transition-colors hover:text-foreground"
              style={{ color: "#6B5D4F" }}
            >
              Pricing
            </a>
            <a
              href="/auth"
              className="font-body text-sm font-medium transition-colors hover:text-foreground"
              style={{ color: "#C4956A" }}
            >
              Sign In
            </a>
          </>
        ) : null}
      </div>
    </nav>
  );
};

export default MinimalNav;
