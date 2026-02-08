import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Paperclip, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "rabbit" | "user";
  content: string;
  photos?: string[]; // object URLs for preview
};

type ConversationState = "greeting" | "waiting_for_input" | "responded" | "ready_for_auth" | "auth_shown";

export type RabbitChatHandle = {
  setInput: (text: string) => void;
};
// Simple intent detection
function detectIntent(text: string): "pet" | "person" | "how" | "price" | "example" | "general" {
  const lower = text.toLowerCase();
  if (/how (does|do)|how it work|what is this|what do you do/.test(lower)) return "how";
  if (/how much|price|cost|pricing|\$/.test(lower)) return "price";
  if (/example|sample|see.*book|show me/.test(lower)) return "example";
  if (/dog|cat|pet|puppy|kitten|bird|rabbit|hamster|fish|passed away|lost my|memorial|fur/.test(lower)) return "pet";
  if (/mom|dad|grandpa|grandma|friend|baby|kid|son|daughter|husband|wife|family|person/.test(lower)) return "person";
  return "general";
}

function getRabbitResponse(userText: string, hasPhotos: boolean, state: ConversationState): { text: string; nextState: ConversationState } {
  // If they just dropped photos without text
  if (hasPhotos && !userText.trim()) {
    return {
      text: "Oh, I love these! Tell me a little about who I'm looking at — and what you want to make.",
      nextState: "responded",
    };
  }

  const intent = detectIntent(userText);

  if (intent === "how") {
    return {
      text: "You share photos, we chat about the memories, and I create a fully illustrated book (or card, or portrait) that actually looks like YOUR person or pet. Every single one is unique. Want to try it?",
      nextState: "responded",
    };
  }

  if (intent === "price") {
    return {
      text: "Uploading photos, chatting, and writing the story is completely free. You only pay for illustration credits — starting at $4.99. Every new account gets 3 free credits to try it out. Want to give it a shot?",
      nextState: "responded",
    };
  }

  if (intent === "example") {
    return {
      text: "Imagine a beautifully illustrated children's book where every page features scenes drawn from YOUR real photos — the actual places, the real expressions, the moments that matter. Each one is completely unique. Drop some photos and I'll show you what I mean.",
      nextState: "responded",
    };
  }

  if (intent === "pet") {
    return {
      text: `Got it — I can already picture it. Let's make something beautiful for them. To get started, I just need you to create a free account. Takes 10 seconds.`,
      nextState: "ready_for_auth",
    };
  }

  if (intent === "person") {
    return {
      text: "That sounds amazing. I'd love to help you make that. Let's set up your account real quick and we'll get going.",
      nextState: "ready_for_auth",
    };
  }

  // General / unclear
  if (state === "responded" || hasPhotos) {
    return {
      text: "I love it. Let me set you up so we can get started — takes 10 seconds.",
      nextState: "ready_for_auth",
    };
  }

  return {
    text: "Sounds great! Tell me more — who is this for, and what kind of creation are you imagining? A book, a card, a portrait?",
    nextState: "responded",
  };
}

const RABBIT_AVATAR = (
  <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: "#E8D5C0" }}>
    🐇
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-start gap-3">
    {RABBIT_AVATAR}
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
);

interface RabbitChatProps {
  onBookTypeClick?: (type: string) => void;
}

const RabbitChat = forwardRef<RabbitChatHandle, RabbitChatProps>(({ onBookTypeClick }, ref) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>("greeting");
  const [droppedPhotos, setDroppedPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    setInput: (text: string) => {
      setInput(text);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    },
  }));

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  const addRabbitMessage = useCallback((text: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "rabbit", content: text }]);
      setIsTyping(false);
      scrollToBottom();
    }, 600 + Math.random() * 400);
  }, [scrollToBottom]);

  // Opening message
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setTimeout(() => {
      addRabbitMessage("Hey! I'm Rabbit 🐇 Drop some photos of someone you love — a pet, a person, anyone — and tell me what you want to make. A book, a card, a portrait, anything.");
      setConversationState("waiting_for_input");
    }, 300);
  }, [addRabbitMessage]);

  const handleSend = () => {
    const text = input.trim();
    if (!text && photoUrls.length === 0) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      photos: photoUrls.length > 0 ? [...photoUrls] : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    scrollToBottom();

    // Clear photo previews after sending
    const hadPhotos = photoUrls.length > 0;
    setPhotoUrls([]);

    // Get rabbit response
    const { text: response, nextState } = getRabbitResponse(text, hadPhotos, conversationState);
    setConversationState(nextState);
    addRabbitMessage(response);

    // If ready for auth, show auth form after the response
    if (nextState === "ready_for_auth") {
      setTimeout(() => {
        setConversationState("auth_shown");
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "rabbit",
          content: "__AUTH_FORM__",
        }]);
        scrollToBottom();
      }, 1800);
    }
  };

  const handlePhotoSelect = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setDroppedPhotos(prev => [...prev, ...imageFiles]);
    const urls = imageFiles.map(f => URL.createObjectURL(f));
    setPhotoUrls(prev => [...prev, ...urls]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handlePhotoSelect(e.dataTransfer.files);
  };

  const handleMagicLink = async () => {
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    try {
      // Store pre-auth context
      if (droppedPhotos.length > 0 || messages.some(m => m.role === "user")) {
        const context = messages.filter(m => m.role === "user").map(m => m.content).join(" | ");
        localStorage.setItem("photorabbit_preauth_context", context);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/project/new` },
      });
      if (error) throw error;
      addRabbitMessage("Check your email — I just sent you a magic link. Click it and we'll pick right up where we left off.");
    } catch (err) {
      toast.error("Failed to send magic link. Try again?");
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    // Store pre-auth context
    if (droppedPhotos.length > 0 || messages.some(m => m.role === "user")) {
      const context = messages.filter(m => m.role === "user").map(m => m.content).join(" | ");
      localStorage.setItem("photorabbit_preauth_context", context);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/project/new` },
    });
    if (error) {
      toast.error("Google sign-in failed. Try the magic link instead?");
      console.error(error);
    }
  };

  const handleBookTypeClick = (type: string) => {
    const typeMessages: Record<string, string> = {
      "Pet Memorial": "I want to make a pet memorial book",
      "Kid's Adventure": "I want to make a kid's adventure book",
      "Grandparent Book": "I want to make a book for my grandparents",
      "Roast Book": "I want to make a funny roast book",
    };
    const text = typeMessages[type] || `I want to make a ${type}`;
    setInput(text);
    onBookTypeClick?.(type);
  };

  return (
    <div
      className="flex flex-col h-full max-w-[700px] w-full mx-auto"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 py-6 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "items-start gap-3"}`}
            >
              {msg.role === "rabbit" && msg.content !== "__AUTH_FORM__" && RABBIT_AVATAR}

              {msg.content === "__AUTH_FORM__" ? (
                /* Inline auth form */
                <div className="flex items-start gap-3 w-full">
                  {RABBIT_AVATAR}
                  <div
                    className="rounded-2xl rounded-tl-md px-5 py-4 max-w-[85%] space-y-3"
                    style={{ background: "#F5EDE4", border: "1px solid #E8D5C0" }}
                  >
                    <p className="font-body text-sm" style={{ color: "#2C2417" }}>
                      Create your free account:
                    </p>
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
                      onClick={handleGoogleAuth}
                      className="w-full flex items-center justify-center gap-2 rounded-xl h-10 text-sm font-body font-medium transition-colors hover:bg-white/80"
                      style={{ background: "white", border: "1px solid #E8D5C0", color: "#2C2417" }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Continue with Google
                    </button>
                  </div>
                </div>
              ) : msg.role === "rabbit" ? (
                <div
                  className="rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]"
                  style={{ background: "#F5EDE4", border: "1px solid #E8D5C0" }}
                >
                  <p className="font-body text-[15px] leading-relaxed" style={{ color: "#2C2417" }}>
                    {msg.content}
                  </p>
                </div>
              ) : (
                <div className="max-w-[80%] space-y-2">
                  {msg.photos && msg.photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-end">
                      {msg.photos.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Uploaded photo"
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {msg.content && (
                    <div
                      className="rounded-2xl rounded-tr-md px-4 py-3 ml-auto"
                      style={{ background: "#E8D5C0" }}
                    >
                      <p className="font-body text-[15px] leading-relaxed" style={{ color: "#2C2417" }}>
                        {msg.content}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && <TypingIndicator />}
      </div>

      {/* Photo previews */}
      {photoUrls.length > 0 && (
        <div className="px-4 md:px-0 pb-2 flex gap-2 flex-wrap">
          {photoUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover border" style={{ borderColor: "#E8D5C0" }} />
              <button
                onClick={() => {
                  setPhotoUrls(prev => prev.filter((_, j) => j !== i));
                  setDroppedPhotos(prev => prev.filter((_, j) => j !== i));
                }}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {conversationState !== "auth_shown" && (
        <div className="px-4 md:px-0 pb-4">
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2 rounded-2xl px-4 py-2"
            style={{ background: "white", border: "2px solid #E8D5C0" }}
          >
            <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" multiple onChange={e => e.target.files && handlePhotoSelect(e.target.files)} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded-lg transition-colors hover:bg-secondary"
              style={{ color: "#9B8E7F" }}
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={chatInputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Tell Rabbit what you're making..."
              className="flex-1 bg-transparent border-none outline-none font-body text-[15px] placeholder:text-[#9B8E7F]"
              style={{ color: "#2C2417" }}
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={isTyping || (!input.trim() && photoUrls.length === 0)}
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{ background: "#C4956A", color: "white" }}
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
});

RabbitChat.displayName = "RabbitChat";

export default RabbitChat;
