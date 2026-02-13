import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, MessageCircle, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import MinimalNav from "@/components/workspace/MinimalNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enableDevMode } from "@/lib/devMode";

const Landing = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((files: File[]) => {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return;
    const urls = images.map(f => URL.createObjectURL(f));
    setPreviewUrls(prev => [...prev, ...urls]);
    setShowAuth(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileDrop(Array.from(e.dataTransfer.files));
  }, [handleFileDrop]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFileDrop(Array.from(e.target.files));
  };

  const handleMagicLink = async () => {
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success("Check your email — magic link sent!");
    } catch {
      toast.error("Failed to send magic link.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Google sign-in failed.");
  };

  const steps = [
    {
      icon: Upload,
      title: "Drop your photos",
      desc: "The ones that mean something. Pets, kids, trips, people you miss.",
    },
    {
      icon: MessageCircle,
      title: "Talk to Rabbit",
      desc: "Tell the story behind them. Rabbit pulls out the details that matter.",
    },
    {
      icon: BookOpen,
      title: "Get a real book",
      desc: "Illustrated, written, one-of-one. Not a template. A gift.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MinimalNav showAuth={true} />

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl"
        >
          {/* Rabbit */}
          <div className="flex justify-center mb-10">
            <RabbitCharacter state={previewUrls.length > 0 ? "excited" : "idle"} size={180} />
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight text-foreground mb-5">
            Your photos.{" "}
            <span className="text-primary">Your story.</span>
            <br />A real book.
          </h1>
          <p className="font-body text-lg md:text-xl text-muted-foreground mb-12 max-w-lg mx-auto leading-relaxed">
            Drop photos of anyone you love. Rabbit turns them into an illustrated book that didn't exist until you showed up.
          </p>

          {/* Photo previews */}
          {previewUrls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-2 justify-center flex-wrap mb-8"
            >
              {previewUrls.slice(0, 8).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-16 h-16 rounded-xl object-cover border border-border"
                  style={{ boxShadow: "var(--shadow-sm)" }}
                />
              ))}
              {previewUrls.length > 8 && (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-secondary">
                  <span className="font-body text-sm font-semibold text-muted-foreground">
                    +{previewUrls.length - 8}
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* Upload zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="group rounded-2xl border-2 border-dashed border-border bg-card p-10 cursor-pointer transition-all hover:border-primary/50 mx-auto max-w-md"
            style={{ boxShadow: "var(--shadow-sm)" }}
            role="button"
            tabIndex={0}
            onKeyDown={e =>
              (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()
            }
          >
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              aria-label="Upload photos"
            />
            <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <p className="font-body text-base font-semibold text-foreground mb-1">
              {previewUrls.length > 0 ? "Drop more photos" : "Drop photos here"}
            </p>
            <p className="font-body text-sm text-muted-foreground">
              {previewUrls.length > 0
                ? `${previewUrls.length} selected — keep going`
                : "Or click to browse. More photos = better book."}
            </p>
          </div>

          {/* Auth — appears after first photo */}
          {showAuth && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl bg-card border border-border p-6 space-y-4 mx-auto max-w-md mt-6"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <p className="font-body text-sm font-semibold text-foreground">
                Sign in to start your book
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                  className="rounded-xl text-sm h-11 flex-1 bg-background border-border"
                  disabled={authLoading}
                />
                <Button
                  size="sm"
                  className="rounded-xl h-11 px-5 shrink-0 gap-1"
                  onClick={handleMagicLink}
                  disabled={authLoading || !authEmail.trim()}
                >
                  {authLoading ? "Sending..." : <>Go <ArrowRight className="w-3.5 h-3.5" /></>}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-body text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2 rounded-xl h-11 text-sm font-body font-medium bg-background border border-border text-foreground hover:bg-secondary transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-t border-border py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground text-center mb-16">
            Three steps. One book.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  <step.icon className="w-6 h-6 text-foreground" />
                </div>
                <p className="font-body text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                  {i + 1}
                </p>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="border-t border-border py-20 px-4 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-5">
          Make something real.
        </h2>
        <p className="font-body text-muted-foreground mb-10 max-w-md mx-auto text-lg">
          It starts with a few photos. No account until you're ready.
        </p>
        <Button
          size="lg"
          variant="hero"
          className="rounded-xl px-10 h-12"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload photos
          <Upload className="w-4 h-4 ml-2" />
        </Button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center">
        <div className="flex items-center justify-center gap-5 font-body text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">PhotoRabbit</span>
          <span>&copy; {new Date().getFullYear()}</span>
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          <button
            onClick={() => { enableDevMode(); window.location.reload(); }}
            className="opacity-0 hover:opacity-100 transition-opacity"
          >
            Dev
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
