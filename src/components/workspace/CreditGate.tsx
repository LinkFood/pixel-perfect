import { useState, useEffect, useRef } from "react";
import { Coins, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreditGateProps {
  balance: number;
  onCreditAvailable: () => void;
  tokenCost?: number;
  productLabel?: string;
}

const CreditGate = ({ balance, onCreditAvailable, tokenCost = 1, productLabel }: CreditGateProps) => {
  const { isAnonymous } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const prevAnonymousRef = useRef(isAnonymous);

  // Watch for anonymous → authenticated transition
  useEffect(() => {
    if (prevAnonymousRef.current && !isAnonymous) {
      onCreditAvailable();
    }
    prevAnonymousRef.current = isAnonymous;
  }, [isAnonymous, onCreditAvailable]);

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Store current URL so user returns here after email confirmation
      localStorage.setItem("photorabbit_redirect", window.location.href);
      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
      });
      if (error) throw error;
      toast.success("Check your email to verify your account");
    } catch {
      toast.error("Failed to send verification email.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) {
      toast.error("Google sign-in failed.");
      setGoogleLoading(false);
    }
    // Don't reset on success — redirect happens
  };

  if (balance > 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 p-6 space-y-4 bg-card shadow-chat max-w-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Coins className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-display text-base font-bold text-foreground">
            {isAnonymous ? "Sign up to continue" : "Out of credits"}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {isAnonymous
              ? `Create a free account — get 5 free tokens`
              : `Need ${tokenCost} token${tokenCost !== 1 ? "s" : ""}${productLabel ? ` for ${productLabel}` : ""} · ${balance} remaining`}
          </p>
        </div>
      </div>

      {isAnonymous ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleMagicLink()}
              className="rounded-xl text-sm h-10 flex-1 bg-card border-border/60 shadow-chat"
              disabled={loading}
              autoFocus
            />
            <Button
              size="sm"
              className="rounded-xl h-10 px-4 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleMagicLink}
              disabled={loading || !email.trim()}
            >
              {loading ? "..." : <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-body text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-body font-medium bg-card border border-border/60 text-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-body text-sm text-muted-foreground">
            More credits coming soon. For now, you can still review and share your existing books.
          </p>
        </div>
      )}
    </div>
  );
};

export default CreditGate;
