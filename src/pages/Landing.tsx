import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ArrowRight } from "lucide-react";
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

  const hasPhotos = previewUrls.length > 0;

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <MinimalNav showAuth={true} />

      {/* Single screen — rabbit + action */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center w-full max-w-sm"
        >
          {/* Rabbit */}
          <div className="flex justify-center mb-4">
            <RabbitCharacter state={hasPhotos ? "excited" : "idle"} size={160} />
          </div>

          {/* Speech bubble */}
          <AnimatePresence mode="wait">
            <motion.p
              key={hasPhotos ? "has-photos" : "no-photos"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="font-body text-base text-muted-foreground mb-6"
            >
              {hasPhotos
                ? "Nice! Sign in and let's make something."
                : "Drop some photos — I'll turn them into a book."}
            </motion.p>
          </AnimatePresence>

          {/* Photo previews */}
          <AnimatePresence>
            {hasPhotos && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-1.5 justify-center flex-wrap mb-5"
              >
                {previewUrls.slice(0, 6).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                  />
                ))}
                {previewUrls.length > 6 && (
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-secondary">
                    <span className="font-body text-xs font-medium text-muted-foreground">
                      +{previewUrls.length - 6}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drop zone OR auth — one or the other takes focus */}
          <AnimatePresence mode="wait">
            {!showAuth ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-border bg-card p-5 cursor-pointer transition-all hover:border-primary/40 mx-auto"
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
                <Upload className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="font-body text-sm font-medium text-foreground">
                  Drop photos here
                </p>
                <p className="font-body text-xs text-muted-foreground mt-0.5">
                  Or click to browse. More photos = better book.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 mx-auto"
              >
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                    className="rounded-xl text-sm h-10 flex-1 bg-background border-border"
                    disabled={authLoading}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="rounded-xl h-10 px-4 shrink-0 gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleMagicLink}
                    disabled={authLoading || !authEmail.trim()}
                  >
                    {authLoading ? "..." : <><ArrowRight className="w-4 h-4" /></>}
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-body text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <button
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-body font-medium bg-background border border-border text-foreground hover:bg-secondary transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>
                <button
                  onClick={() => { setShowAuth(false); fileInputRef.current?.click(); }}
                  className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Add more photos
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Tiny footer */}
      <div className="flex items-center justify-center gap-3 py-3 font-body text-[11px] text-muted-foreground/60">
        <span>PhotoRabbit</span>
        <span>&copy; {new Date().getFullYear()}</span>
        <a href="#" className="hover:text-muted-foreground transition-colors">Privacy</a>
        <a href="#" className="hover:text-muted-foreground transition-colors">Terms</a>
        <button
          onClick={() => { enableDevMode(); window.location.reload(); }}
          className="opacity-0 hover:opacity-100 transition-opacity"
        >
          Dev
        </button>
      </div>
    </div>
  );
};

export default Landing;
