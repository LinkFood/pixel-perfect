import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Coins, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
  const [open, setOpen] = useState(false);
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container mx-auto px-6 lg:px-12 flex items-center justify-between h-16">
        <a href="/" className="font-display text-lg font-semibold text-foreground tracking-tight">
          PhotoRabbit
        </a>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#how" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
          <a href="#pricing" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="#stories" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Stories</a>
          
          {!loading && user ? (
            <div className="flex items-center gap-4">
              {credits !== null && (
                <div className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="font-semibold text-foreground">{credits}</span>
                </div>
              )}
              <a href="/dashboard">
                <Button variant="hero" size="sm" className="rounded-lg px-5">
                  Dashboard
                </Button>
              </a>
              <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a href="/auth">
              <Button variant="hero" size="sm" className="rounded-lg px-5">
                Get Started
              </Button>
            </a>
          )}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background border-b border-border px-6 pb-6 space-y-4">
          <a href="#how" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>How It Works</a>
          <a href="#pricing" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#stories" className="block font-body text-sm text-muted-foreground" onClick={() => setOpen(false)}>Stories</a>
          {!loading && user ? (
            <>
              {credits !== null && (
                <div className="flex items-center gap-1.5 font-body text-sm text-muted-foreground">
                  <Coins className="w-4 h-4 text-accent" />
                  <span className="font-semibold text-foreground">{credits} credits</span>
                </div>
              )}
              <a href="/dashboard"><Button variant="hero" size="sm" className="w-full rounded-lg">Dashboard</Button></a>
              <Button variant="outline" size="sm" className="w-full rounded-lg" onClick={signOut}>Sign Out</Button>
            </>
          ) : (
            <a href="/auth"><Button variant="hero" size="sm" className="w-full rounded-lg">Get Started</Button></a>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
