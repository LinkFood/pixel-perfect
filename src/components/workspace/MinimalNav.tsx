import { LogOut, Coins, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth, useCredits } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isDevMode, disableDevMode } from "@/lib/devMode";

interface MinimalNavProps {
  showAuth?: boolean;
  isHero?: boolean;
}

const MinimalNav = ({ showAuth = true, isHero = false }: MinimalNavProps) => {
  const { user, loading, isAnonymous, signOut } = useAuth();
  const { balance: credits } = useCredits();

  return (
    <nav className={`flex items-center justify-between px-6 lg:px-12 h-14 shrink-0 transition-colors ${isHero ? "border-b border-transparent bg-transparent" : "border-b border-border/50"}`}>
      <Link
        to="/"
        className="font-display text-lg font-semibold tracking-tight text-foreground"
      >
        PhotoRabbit
      </Link>

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
            {!isAnonymous && (
              <button
                onClick={signOut}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </>
        ) : null}
      </div>
    </nav>
  );
};

export default MinimalNav;
