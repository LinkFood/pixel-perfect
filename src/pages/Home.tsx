import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Workspace from "@/components/workspace/Workspace";
import Landing from "./Landing";
import { isDevMode } from "@/lib/devMode";
import { supabase } from "@/integrations/supabase/client";

const DEV_EMAIL = "dev@photorabbit.test";
const DEV_PASSWORD = "devmode123";

const Home = () => {
  const { user, loading } = useAuth();
  const [devSigningIn, setDevSigningIn] = useState(false);

  useEffect(() => {
    if (!isDevMode() || user || loading || devSigningIn) return;

    const autoSignIn = async () => {
      setDevSigningIn(true);
      try {
        // Ensure the dev user exists
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-dev-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        // Sign in
        await supabase.auth.signInWithPassword({
          email: DEV_EMAIL,
          password: DEV_PASSWORD,
        });
      } catch (e) {
        console.error("Dev auto-sign-in failed:", e);
      } finally {
        setDevSigningIn(false);
      }
    };

    autoSignIn();
  }, [user, loading, devSigningIn]);

  if (isDevMode() && (!user || devSigningIn || loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
      </div>
    );
  }

  if (user) {
    return <Workspace />;
  }

  return <Landing />;
};

export default Home;
