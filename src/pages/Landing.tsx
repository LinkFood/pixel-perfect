import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatInput from "@/components/workspace/ChatInput";
import ChatMessage from "@/components/workspace/ChatMessage";
import MinimalNav from "@/components/workspace/MinimalNav";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Intent detection ───────────────────────────────────────
function detectIntent(text: string): "pet" | "person" | "how" | "price" | "example" | "general" {
  const lower = text.toLowerCase();
  if (/how (does|do)|how it work|what is this|what do you do/.test(lower)) return "how";
  if (/how much|price|cost|pricing|\$/.test(lower)) return "price";
  if (/example|sample|see.*book|show me/.test(lower)) return "example";
  if (/dog|cat|pet|puppy|kitten|bird|rabbit|hamster|fish|passed away|lost my|memorial|fur/.test(lower)) return "pet";
  if (/mom|dad|grandpa|grandma|friend|baby|kid|son|daughter|husband|wife|family|person/.test(lower)) return "person";
  return "general";
}

type ConvState = "greeting" | "waiting" | "responded" | "ready_for_auth" | "auth_shown";

function getRabbitResponse(text: string, hasPhotos: boolean, state: ConvState): { text: string; nextState: ConvState; rabbitState: RabbitState } {
  if (hasPhotos && !text.trim()) {
    return { text: "Oh, I love these! Tell me about who I'm looking at — and what you want to make.", nextState: "responded", rabbitState: "excited" };
  }
  const intent = detectIntent(text);
  if (intent === "how") {
    return { text: "You share photos, we chat about the memories, and I create a fully illustrated book that actually looks like YOUR person or pet. Every single one is unique. Want to try it?", nextState: "responded", rabbitState: "idle" };
  }
  if (intent === "price") {
    return { text: "Uploading photos, chatting, and writing the story is completely free. You only pay for illustration credits — starting at $4.99. Every new account gets 3 free credits to try it out.", nextState: "responded", rabbitState: "idle" };
  }
  if (intent === "example") {
    return { text: "Imagine a beautifully illustrated book where every page features scenes drawn from YOUR real photos — the actual places, the real expressions, the moments that matter. Drop some photos and I'll show you!", nextState: "responded", rabbitState: "presenting" };
  }
  if (intent === "pet") {
    return { text: "Got it — I can already picture it. Let's make something beautiful. To get started, I just need you to create a free account. Takes 10 seconds.", nextState: "ready_for_auth", rabbitState: "sympathetic" };
  }
  if (intent === "person") {
    return { text: "That sounds amazing. I'd love to help you make that. Let's set up your account real quick.", nextState: "ready_for_auth", rabbitState: "excited" };
  }
  if (state === "responded" || hasPhotos) {
    return { text: "I love it. Let me set you up so we can get started — takes 10 seconds.", nextState: "ready_for_auth", rabbitState: "excited" };
  }
  return { text: "Sounds great! Tell me more — who is this for, and what kind of creation are you imagining? A book, a card, a portrait?", nextState: "responded", rabbitState: "listening" };
}

// ─── FAQ data ───────────────────────────────────────────────
const faqs = [
  { q: "What can I make?", a: "Books, cards, portraits — anything illustrated from your real photos. You chat with Rabbit about the memories, and we create something completely unique." },
  { q: "How long does it take?", a: "The chat takes about 10 minutes, generation takes about 15 minutes, and you review everything before paying. Most people finish in under an hour." },
  { q: "How much does it cost?", a: "Uploading photos, chatting, and story writing are free. You only pay for illustration credits — starting at $4.99 for 15 credits. Every new account gets 3 free credits." },
  { q: "Is this AI-generated?", a: "Yes — our AI studies YOUR photos so illustrations actually look like your person or pet. You approve every single page before anything is finalized." },
];

// ─── Floating book thumbnails ───────────────────────────────
const bookTypes = [
  { label: "Pet Memorial", angle: -6, top: "20%", left: "-50px", color: "#D4A574" },
  { label: "Kid's Adventure", angle: 4, top: "40%", right: "-50px", color: "#8FB5A3" },
  { label: "Grandparent Book", angle: -3, bottom: "35%", left: "-40px", color: "#B8A4C8" },
  { label: "Roast Book", angle: 5, bottom: "18%", right: "-40px", color: "#E8B4A0" },
];

// ─── Component ──────────────────────────────────────────────
const Landing = () => {
  const [messages, setMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[] }>>([]);
  const [input, setInput] = useState("");
  const [convState, setConvState] = useState<ConvState>("greeting");
  const [rabbitState, setRabbitState] = useState<RabbitState>("idle");
  const [isTyping, setIsTyping] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  const addRabbitMessage = useCallback((text: string, newRabbitState?: RabbitState) => {
    setIsTyping(true);
    if (newRabbitState) setRabbitState(newRabbitState);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "rabbit", content: text }]);
      setIsTyping(false);
      scrollToBottom();
    }, 600 + Math.random() * 400);
  }, [scrollToBottom]);

  // Opening message
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setTimeout(() => {
      addRabbitMessage("Hey! I'm Rabbit. Drop some photos of someone you love — a pet, a person, anyone — and tell me what you want to make.");
      setConvState("waiting");
    }, 500);
  }, [addRabbitMessage]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && photoUrls.length === 0) return;

    setMessages(prev => [...prev, { role: "user", content: text, photos: photoUrls.length > 0 ? [...photoUrls] : undefined }]);
    setInput("");
    const hadPhotos = photoUrls.length > 0;
    setPhotoUrls([]);
    scrollToBottom();

    const { text: response, nextState, rabbitState: newState } = getRabbitResponse(text, hadPhotos, convState);
    setConvState(nextState);
    addRabbitMessage(response, newState);

    if (nextState === "ready_for_auth") {
      setTimeout(() => {
        setConvState("auth_shown");
        setMessages(prev => [...prev, { role: "rabbit", content: "__AUTH_FORM__" }]);
        scrollToBottom();
      }, 1800);
    }
  };

  const handlePhotos = (files: File[]) => {
    const urls = files.map(f => URL.createObjectURL(f));
    setPhotoUrls(prev => [...prev, ...urls]);
    setRabbitState("excited");
  };

  const handleMagicLink = async () => {
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    try {
      // Store context
      const ctx = messages.filter(m => m.role === "user").map(m => m.content).join(" | ");
      if (ctx) localStorage.setItem("photorabbit_preauth_context", ctx);
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      addRabbitMessage("Check your email — I just sent you a magic link. Click it and we'll pick right up where we left off.");
    } catch {
      toast.error("Failed to send magic link.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogle = async () => {
    const ctx = messages.filter(m => m.role === "user").map(m => m.content).join(" | ");
    if (ctx) localStorage.setItem("photorabbit_preauth_context", ctx);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Google sign-in failed.");
  };

  const handleBookClick = (label: string) => {
    const msgs: Record<string, string> = {
      "Pet Memorial": "I want to make a pet memorial book",
      "Kid's Adventure": "I want to make a kid's adventure book",
      "Grandparent Book": "I want to make a book for my grandparents",
      "Roast Book": "I want to make a funny roast book",
    };
    setInput(msgs[label] || `I want to make a ${label}`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
      <MinimalNav showAuth={true} />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Floating book thumbnails — desktop, very subtle */}
        <div className="hidden lg:block absolute inset-0 pointer-events-none">
          {bookTypes.map(book => (
            <motion.div
              key={book.label}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                top: book.top, bottom: book.bottom, left: book.left, right: book.right,
                transform: `rotate(${book.angle}deg)`,
                opacity: 0.15,
              }}
              whileHover={{ opacity: 0.6, scale: 1.05 }}
              onClick={() => handleBookClick(book.label)}
            >
              <div
                className="w-[80px] h-[100px] rounded-lg shadow-md flex items-end p-2"
                style={{ background: `linear-gradient(135deg, ${book.color}, ${book.color}dd)` }}
              >
                <span className="font-body text-[8px] font-medium text-white leading-tight">{book.label}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex flex-col h-full max-w-[700px] w-full mx-auto">
          {/* Rabbit */}
          <div className="flex justify-center py-6 shrink-0">
            <RabbitCharacter state={rabbitState} size={180} />
          </div>

          {/* Chat */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) =>
                msg.content === "__AUTH_FORM__" ? (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage role="rabbit" content="">
                      <div
                        className="rounded-2xl rounded-tl-md px-5 py-4 space-y-3"
                        style={{ background: "#F5EDE4", border: "1px solid #E8D5C0" }}
                      >
                        <p className="font-body text-sm" style={{ color: "#2C2417" }}>Create your free account:</p>
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
                            variant="hero"
                            size="sm"
                            className="rounded-xl h-10 px-4 shrink-0"
                            onClick={handleMagicLink}
                            disabled={authLoading || !authEmail.trim()}
                          >
                            {authLoading ? "Sending..." : "Magic Link"}
                          </Button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="h-px flex-1" style={{ background: "#E8D5C0" }} />
                          <span className="text-xs font-body" style={{ color: "#9B8E7F" }}>or</span>
                          <div className="h-px flex-1" style={{ background: "#E8D5C0" }} />
                        </div>
                        <button
                          onClick={handleGoogle}
                          className="w-full flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-body font-medium hover:bg-white/80"
                          style={{ background: "white", border: "1px solid #E8D5C0", color: "#2C2417" }}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Continue with Google
                        </button>
                      </div>
                    </ChatMessage>
                  </motion.div>
                ) : (
                  <ChatMessage key={i} role={msg.role} content={msg.content} photos={msg.photos} />
                )
              )}
            </AnimatePresence>

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-1">
                  <RabbitCharacter state="idle" size={32} />
                </div>
                <div className="rounded-2xl rounded-tl-md px-4 py-3" style={{ background: "#F5EDE4", border: "1px solid #E8D5C0" }}>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full"
                        style={{ background: "#C4956A" }}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.5, delay: i * 0.15, repeat: Infinity, repeatDelay: 0.3 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Photo previews */}
          {photoUrls.length > 0 && (
            <div className="px-4 md:px-0 pb-2 flex gap-2 flex-wrap">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border" style={{ borderColor: "#E8D5C0" }} />
                  <button
                    onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          {convState !== "auth_shown" && (
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onPhotos={handlePhotos}
              disabled={isTyping}
            />
          )}
        </div>
      </div>

      {/* Below the fold */}
      <div style={{ background: "#FDF8F0" }}>
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

        <div id="pricing" className="py-10 border-t" style={{ borderColor: "#E8D5C0" }}>
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
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
