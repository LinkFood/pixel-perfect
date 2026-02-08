import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Camera, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import MinimalNav from "@/components/workspace/MinimalNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { enableDevMode } from "@/lib/devMode";

const faqs = [
  { q: "What can I make?", a: "Books, cards, portraits — anything illustrated from your real photos. You chat with Rabbit about the memories, and we create something completely unique." },
  { q: "How long does it take?", a: "The chat takes about 10 minutes, generation takes about 15 minutes, and you review everything before paying. Most people finish in under an hour." },
  { q: "How much does it cost?", a: "Uploading photos, chatting, and story writing are free. You only pay for illustration credits — starting at $4.99 for 15 credits. Every new account gets 3 free credits." },
  { q: "Is this AI-generated?", a: "Yes — our AI studies YOUR photos so illustrations actually look like your person or pet. You approve every single page before anything is finalized." },
];

const Landing = () => {
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((files: File[]) => {
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length === 0) return;
    // Show previews — files will be lost after redirect, but previews
    // give confidence that it's working. After auth, user re-uploads in Workspace.
    const urls = images.map(f => URL.createObjectURL(f));
    setPreviewUrls(prev => [...prev, ...urls]);
    // Show auth form
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
      <MinimalNav showAuth={true} />

      {/* Hero: Rabbit + Upload */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-lg"
        >
          {/* Rabbit */}
          <div className="flex justify-center mb-6">
            <RabbitCharacter state={previewUrls.length > 0 ? "excited" : "idle"} size={180} />
          </div>

          {/* Headline */}
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-3" style={{ color: "#2C2417" }}>
            Your photos already tell the story.
          </h1>
          <p className="font-body text-base mb-8" style={{ color: "#6B5D4F" }}>
            Drop your photos. Our AI reads every detail — then turns your real memories into a beautifully illustrated book.
          </p>

          {/* Photo previews (if they dropped before signing in) */}
          {previewUrls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex gap-2 justify-center flex-wrap mb-6"
            >
              {previewUrls.slice(0, 8).map((url, i) => (
                <img key={i} src={url} alt="" className="w-16 h-16 rounded-xl object-cover shadow-sm" style={{ border: "2px solid #E8D5C0" }} />
              ))}
              {previewUrls.length > 8 && (
                <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: "#F5EDE4" }}>
                  <span className="font-body text-sm font-medium" style={{ color: "#6B5D4F" }}>+{previewUrls.length - 8}</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Upload zone — always visible so user can keep adding */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all hover:border-[#C4956A]/60 hover:shadow-md mx-auto max-w-md"
            style={{ borderColor: "#D4B896", background: "#FEFCF9" }}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
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
            <Upload className="w-7 h-7 mx-auto mb-2" style={{ color: "#C4956A" }} />
            <p className="font-display text-base font-semibold mb-0.5" style={{ color: "#2C2417" }}>
              {previewUrls.length > 0 ? "Drop more photos" : "Drop your photos here"}
            </p>
            <p className="font-body text-sm" style={{ color: "#9B8E7F" }}>
              {previewUrls.length > 0 ? `${previewUrls.length} selected — keep adding!` : "Or click to browse. The more photos, the better the book."}
            </p>
          </div>

          {/* Auth form — appears after first photo drop */}
          {showAuth && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6 space-y-4 mx-auto max-w-md mt-4"
              style={{ background: "#F5EDE4", border: "1px solid #E8D5C0" }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Camera className="w-5 h-5" style={{ color: "#C4956A" }} />
                <p className="font-body text-sm font-medium" style={{ color: "#2C2417" }}>
                  Sign in to start — you'll re-upload after
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleMagicLink()}
                  className="rounded-xl text-sm h-10 flex-1"
                  style={{ background: "white", border: "1px solid #E8D5C0" }}
                  disabled={authLoading}
                />
                <Button
                  size="sm"
                  className="rounded-xl h-10 px-4 shrink-0 gap-1"
                  style={{ background: "#C4956A", color: "white" }}
                  onClick={handleMagicLink}
                  disabled={authLoading || !authEmail.trim()}
                >
                  {authLoading ? "Sending..." : <>Go <ArrowRight className="w-3 h-3" /></>}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: "#E8D5C0" }} />
                <span className="text-xs font-body" style={{ color: "#9B8E7F" }}>or</span>
                <div className="h-px flex-1" style={{ background: "#E8D5C0" }} />
              </div>
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-body font-medium hover:bg-white/80 transition-colors"
                style={{ background: "white", border: "1px solid #E8D5C0", color: "#2C2417" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>


      {/* Below the fold */}
      <div style={{ background: "#FDF8F0" }}>
        {/* Testimonials */}
        <div className="py-10 border-t" style={{ borderColor: "#E8D5C0" }}>
          <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
            <p className="font-display text-sm uppercase tracking-[0.2em]" style={{ color: "#9B8E7F" }}>From our community</p>
            <div className="space-y-4">
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "I thought no one could capture what Max meant to us. Then I saw the book and cried — in the best way."
                <span className="not-italic font-medium"> — Sarah M.</span>
              </p>
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "We made a birthday book for my daughter's 5th. The AI pulled out stories I'd forgotten. She carries it everywhere."
                <span className="not-italic font-medium"> — David K.</span>
              </p>
              <p className="font-body text-sm italic" style={{ color: "#6B5D4F" }}>
                "Our friend group made a roast book for Jake's 30th. He ugly-cried at the party. Best $10 we ever split."
                <span className="not-italic font-medium"> — Priya N.</span>
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="py-10 border-t" style={{ borderColor: "#E8D5C0" }}>
          <div className="max-w-xl mx-auto px-6">
            <h3 className="font-display text-lg font-semibold text-center mb-6" style={{ color: "#2C2417" }}>Common Questions</h3>
            <Accordion type="single" collapsible className="space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-xl border px-4" style={{ borderColor: "#E8D5C0" }}>
                  <AccordionTrigger className="font-body text-sm font-medium py-3 hover:no-underline" style={{ color: "#2C2417" }}>{faq.q}</AccordionTrigger>
                  <AccordionContent className="font-body text-sm pb-3" style={{ color: "#6B5D4F" }}>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>

        <footer className="py-6 border-t text-center" style={{ borderColor: "#E8D5C0" }}>
          <div className="flex items-center justify-center gap-4 font-body text-xs" style={{ color: "#9B8E7F" }}>
            <span>PhotoRabbit</span>
            <span>&copy; {new Date().getFullYear()}</span>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <button
              onClick={() => { enableDevMode(); window.location.reload(); }}
              className="hover:underline opacity-30 hover:opacity-100 transition-opacity"
            >
              Dev
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
