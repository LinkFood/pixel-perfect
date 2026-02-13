import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MessageCircle, BookOpen } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";

interface HeroLandingProps {
  onPhotoDrop: (files: File[]) => void;
}

// ─── Rabbit personality lines (rotates on load) ────────────────
const rabbitLines = [
  "Drop some photos. I'll make them into something you'll cry about.",
  "I just finished painting a book about a golden retriever named Biscuit. Your turn.",
  "Fun fact: I've painted 847 books and cried at every single one.",
  "The last person who dropped photos here sent the book to their mom. She called them sobbing. Good sobbing.",
  "I paint books from your photos. Real ones. The kind people keep.",
  "Got pet photos? Kid photos? Vacation photos? I don't care. Drop them. Let's make something.",
];

// ─── Auto-playing flipbook spreads ─────────────────────────────
const showcaseSpreads = [
  {
    title: "The Great Sock Heist",
    text: "Max crept across the living room, his golden tail low, eyes locked on the prize — Dad's favorite argyle sock. This was not his first heist. It would not be his last.",
    gradient: "from-amber-100 to-orange-50",
  },
  {
    title: "Sunrise at the Summit",
    text: "They reached the top just as the sky turned pink. Luna sat at the edge, ears forward, watching the world wake up beneath them. Some adventures you feel forever.",
    gradient: "from-rose-100 to-pink-50",
  },
  {
    title: "The Birthday Surprise",
    text: "The kitchen was covered in flour. Somehow, the cake survived. And somehow, so did the birthday girl's smile — wider than anyone had seen in years.",
    gradient: "from-violet-100 to-indigo-50",
  },
];

// ─── Social proof lines ────────────────────────────────────────
const proofLines = [
  "Just painted 'The Great Sock Heist' — a book about a golden retriever named Max",
  "New book: 'Luna's Mountain' — 22 illustrated pages",
  "Someone just sent 'The Birthday Surprise' to their mom",
  "Just finished: 'Adventures of Captain Whiskers' — 22 pages, cats in space",
  "New book: 'Our First Year' — a couple's story in illustrations",
];

const steps = [
  { icon: Camera, label: "Drop your photos", detail: "Pets, kids, trips — anything" },
  { icon: MessageCircle, label: "Chat with Rabbit", detail: "Tell the story behind them" },
  { icon: BookOpen, label: "Get your book", detail: "22 illustrated pages, yours to keep" },
];

const HeroLanding = ({ onPhotoDrop }: HeroLandingProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ─── Eye tracking ──────────────────────────────────────
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  const rafRef = useRef<number>(0);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) return; // throttle to rAF
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * 0.25;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      setEyeOffset({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
    });
  }, []);

  // ─── Speech bubble rotation ────────────────────────────
  const [lineIndex, setLineIndex] = useState(0);
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    // Initial delay before first line appears
    const initTimer = setTimeout(() => setShowBubble(true), 1500);
    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    if (!showBubble) return;
    let innerTimeout: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setShowBubble(false);
      innerTimeout = setTimeout(() => {
        setLineIndex(prev => (prev + 1) % rabbitLines.length);
        setShowBubble(true);
      }, 400);
    }, 7000);
    return () => { clearInterval(interval); clearTimeout(innerTimeout); };
  }, [showBubble]);

  // ─── Flipbook auto-play ────────────────────────────────
  const [spreadIndex, setSpreadIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSpreadIndex(prev => (prev + 1) % showcaseSpreads.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // ─── Social proof ticker ───────────────────────────────
  const [proofIndex, setProofIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProofIndex(prev => (prev + 1) % proofLines.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Drop handlers ─────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) onPhotoDrop(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) onPhotoDrop(files);
    e.target.value = "";
  };

  const currentSpread = showcaseSpreads[spreadIndex];

  return (
    <div
      ref={heroRef}
      className={`flex-1 overflow-y-auto transition-colors duration-300 ${isDragOver ? "bg-primary/[0.03]" : ""}`}
      onMouseMove={handleMouseMove}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={e => {
        // Only trigger if leaving the hero container itself
        if (heroRef.current && !heroRef.current.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={handleDrop}
    >
      <div className="max-w-2xl mx-auto px-6 pt-6 pb-6 flex flex-col items-center gap-8">

        {/* ── Rabbit + Speech Bubble ── */}
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className={`relative transition-transform duration-300 ${isDragOver ? "scale-105" : ""}`}>
            <RabbitCharacter
              state={isDragOver ? "excited" : "idle"}
              size={200}
              eyeOffset={eyeOffset}
            />

            {/* Speech bubble */}
            <AnimatePresence mode="wait">
              {showBubble && (
                <motion.div
                  key={lineIndex}
                  className="absolute -right-4 top-4 md:left-full md:top-1/4 md:ml-3 max-w-[220px] glass-warm rounded-2xl rounded-bl-sm px-4 py-3 shadow-chat"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="font-body text-xs text-foreground leading-relaxed">
                    {rabbitLines[lineIndex]}
                  </p>
                  {/* Bubble tail */}
                  <div className="absolute -left-1.5 bottom-3 w-3 h-3 glass-warm rotate-45 hidden md:block" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight mt-2">
            Every photo has a story
            <br />
            <span className="text-primary">it never got to tell.</span>
          </h1>

          <p className="font-body text-sm md:text-base text-muted-foreground max-w-md leading-relaxed">
            Drop your photos, chat about the memories, and watch AI write and illustrate a one-of-a-kind picture book.
          </p>
        </motion.div>

        {/* ── Flipbook Showcase ── */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <div className="relative rounded-xl overflow-hidden shadow-float book-page-texture bg-card border border-border/40">
            <AnimatePresence mode="wait">
              <motion.div
                key={spreadIndex}
                className="flex flex-col md:flex-row"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.5 }}
              >
                {/* Illustration side */}
                <div className={`md:w-1/2 aspect-square bg-gradient-to-br ${currentSpread.gradient} flex items-center justify-center p-8`}>
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 text-foreground/10 mx-auto mb-3" />
                    <p className="font-display text-sm font-semibold text-foreground/20">Illustrated page</p>
                  </div>
                </div>
                {/* Text side */}
                <div className="md:w-1/2 p-6 flex flex-col justify-center">
                  <p className="font-display text-lg font-bold text-foreground mb-3 leading-snug">
                    {currentSpread.title}
                  </p>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed italic">
                    "{currentSpread.text}"
                  </p>
                  <div className="flex gap-1 mt-4">
                    {showcaseSpreads.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 rounded-full transition-all duration-500 ${i === spreadIndex ? "w-6 bg-primary" : "w-2 bg-border"}`}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Process Strip ── */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between gap-3">
            {steps.map((step, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-body text-xs font-semibold text-foreground">{step.label}</span>
                <span className="font-body text-[10px] text-muted-foreground leading-snug">{step.detail}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Upload CTA — or click to browse ── */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="sr-only"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-body text-sm font-semibold transition-all hover:brightness-95 active:scale-[0.99] shadow-md hover:shadow-lg"
          >
            Choose photos to start
          </button>
          <p className="text-center font-body text-[11px] text-muted-foreground/60 mt-2">
            or drag and drop anywhere on this page
          </p>
        </motion.div>

        {/* ── Social Proof Ticker ── */}
        <motion.div
          className="w-full max-w-lg h-6 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={proofIndex}
              className="flex items-center justify-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 pulse-glow" />
              <span className="font-body text-[11px] text-muted-foreground/50 truncate">
                {proofLines[proofIndex]}
              </span>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroLanding;
