import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return;
    }
    const pwResult = passwordSchema.safeParse(password);
    if (!pwResult.success) {
      toast.error(pwResult.error.errors[0].message);
      return;
    }

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast.error("Invalid email or password");
          } else {
            toast.error(error.message);
          }
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("This email is already registered. Try logging in instead.");
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success("Check your email to confirm your account!");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      toast.error("Google sign-in failed. Try another method.");
    }
  };

  const handleMagicLink = async () => {
    const result = emailSchema.safeParse(magicLinkEmail);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setMagicLinkSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      toast.success("Check your email for the magic link!");
    } catch {
      toast.error("Failed to send magic link. Try again.");
    } finally {
      setMagicLinkSending(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <a href="/" className="font-display text-2xl font-semibold text-foreground tracking-tight">
            PhotoRabbit
          </a>
          <p className="font-body text-muted-foreground mt-2">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-body font-medium transition-colors hover:bg-secondary/80 bg-card border border-border mb-4"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-body text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Magic Link */}
        <div className="mb-4">
          <div className="flex gap-2">
            <Input
              type="email"
              value={magicLinkEmail}
              onChange={(e) => setMagicLinkEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
              placeholder="your@email.com"
              className="rounded-xl"
              disabled={magicLinkSending || magicLinkSent}
            />
            <Button
              variant="outline"
              className="rounded-xl shrink-0 px-4"
              onClick={handleMagicLink}
              disabled={magicLinkSending || magicLinkSent || !magicLinkEmail.trim()}
            >
              {magicLinkSent ? "Sent!" : magicLinkSending ? "Sending..." : "Magic Link"}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-body text-muted-foreground">or use password</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email/Password */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-body text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-body text-sm">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="rounded-xl"
            />
          </div>
          <Button
            type="submit"
            variant="hero"
            className="w-full rounded-xl py-5"
            disabled={submitting}
          >
            {submitting ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center font-body text-sm text-muted-foreground mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary font-semibold hover:underline"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
