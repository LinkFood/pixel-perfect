import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MessageCircle, BookOpen, Palette } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import { useIsMobile } from "@/hooks/use-mobile";

interface HeroLandingProps {
  onPhotoDrop: (files: File[]) => void;
}

// ─── Rabbit personality lines (rotates on load) ────────────────
const rabbitLines = [
  "Drop some photos. I'll turn them into something that hits different.",
  "Last book I painted was a frat's spring break recap. Before that, a memorial for someone's grandma. I don't judge. I just make it good.",
  "One photo, fifty photos — I don't care. Give me something to work with.",
  "Someone made a book about their cat knocking things off tables. 22 pages. It was a masterpiece.",
  "I've made anniversary gifts, retirement tributes, and a book called 'Why Brad Can't Cook.' All bangers.",
  "Funny, sad, weird, heartfelt — you pick the vibe, I'll paint it.",
];

// ─── Auto-playing flipbook spreads ─────────────────────────────
const showcaseSpreads = [
  {
    title: "The Great Sock Heist",
    text: "Max crept across the living room, his golden tail low, eyes locked on the prize — Dad's favorite argyle sock. This was not his first heist. It would not be his last.",
    gradient: "from-amber-100 to-orange-50",
    illustrationDesc: "A golden retriever army-crawling across the living room, eyes locked on a single argyle sock — tail frozen mid-wag",
  },
  {
    title: "Why Brad Can't Cook",
    text: "The smoke alarm went off for the third time. Brad stood in the kitchen holding a spatula and what used to be an omelet. 'It's rustic,' he said. Nobody believed him.",
    gradient: "from-emerald-100 to-teal-50",
    illustrationDesc: "A smoke-filled kitchen, a bewildered man holding a spatula, and something that used to be an omelet",
  },
  {
    title: "Grandma's Garden",
    text: "She never measured anything — not the soil, not the water, not the love. But everything she planted grew. And everyone who visited left carrying something home.",
    gradient: "from-violet-100 to-indigo-50",
    illustrationDesc: "Morning light through a greenhouse window, weathered hands pressing seeds into dark soil, everything blooming",
  },
];

// ─── Social proof lines ────────────────────────────────────────
const proofLines = [
  "New book: 'The Legend of Drunk Mike' — 18 pages of bad decisions",
  "Someone just turned their Hawaii trip into a bedtime story for their kids",
  "Just finished a retirement tribute — 22 pages, zero dry eyes",
  "New book: 'Why We Don't Let Dad Cook' — sent to an entire family group chat",
  "Someone made a 6-page book from one photo of their dog. It's perfect.",
  "Just painted a couple's first-year anniversary book — she cried on page 4",
];

const steps = [
  { icon: Camera, label: "Drop your photos", detail: "One photo or a hundred" },
  { icon: MessageCircle, label: "Chat with Rabbit", detail: "Pick the vibe — funny, deep, weird, yours" },
  { icon: BookOpen, label: "Get your book", detail: "Illustrated, shareable, yours to keep" },
];

const HeroLanding = ({ onPhotoDrop }: HeroLandingProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const isMobile = useIsMobile();

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
    let initTimer: ReturnType<typeof setTimeout>;
    let cycleInterval: ReturnType<typeof setInterval>;
    let gapTimer: ReturnType<typeof setTimeout>;

    initTimer = setTimeout(() => {
      setShowBubble(true);
      cycleInterval = setInterval(() => {
        setShowBubble(false);
        gapTimer = setTimeout(() => {
          setLineIndex(prev => (prev + 1) % rabbitLines.length);
          setShowBubble(true);
        }, 400);
      }, 7000);
    }, 1500);

    return () => {
      clearTimeout(initTimer);
      clearInterval(cycleInterval);
      clearTimeout(gapTimer);
    };
  }, []);

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
          <div className={`transition-transform duration-300 ${isDragOver ? "scale-105" : ""}`}>
            <RabbitCharacter
              state={isDragOver ? "excited" : "idle"}
              size={isMobile ? 140 : 200}
              eyeOffset={eyeOffset}
            />
          </div>

          {/* Speech bubble — below rabbit, centered */}
          <div className="min-h-[52px] w-full max-w-sm">
            <AnimatePresence mode="wait">
              {showBubble && (
                <motion.div
                  key={lineIndex}
                  className="relative mx-auto w-fit max-w-sm glass-warm rounded-2xl px-5 py-3 shadow-chat"
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="font-body text-sm text-foreground leading-relaxed text-center">
                    {rabbitLines[lineIndex]}
                  </p>
                  {/* Bubble tail pointing up to rabbit */}
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 glass-warm rotate-45" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight mt-2">
            Your photos. My brush.
            <br />
            <span className="text-primary">Zero rules.</span>
          </h1>

          <p className="font-body text-sm md:text-base text-muted-foreground max-w-md leading-relaxed">
            Drop your photos, chat about the memories, and watch AI write and illustrate a one-of-a-kind picture book.
          </p>
        </motion.div>

        {/* ── Flipbook Showcase (hidden on mobile to keep CTA above fold) ── */}
        <motion.div
          className="w-full max-w-lg hidden md:block"
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
                <div className={`md:w-1/2 aspect-square bg-gradient-to-br ${currentSpread.gradient} relative flex items-center justify-center p-8 overflow-hidden`}>
                  {/* Subtle paper texture overlay */}
                  <div className="absolute inset-0 book-page-texture opacity-40" />
                  <div className="relative text-center px-4 flex flex-col items-center justify-center gap-3">
                    <Palette className="w-8 h-8 text-foreground/20" />
                    <p className="font-display text-sm italic text-foreground/40 leading-relaxed">
                      {currentSpread.illustrationDesc}
                    </p>
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
          <motion.button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-body text-sm font-semibold transition-all hover:brightness-105 active:scale-[0.99] shadow-elevated"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{
              boxShadow: [
                "0 0 0px hsl(var(--primary) / 0)",
                "0 0 24px hsl(var(--primary) / 0.3)",
                "0 0 0px hsl(var(--primary) / 0)",
              ],
            }}
            transition={{
              boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            Choose photos to start
          </motion.button>
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
              <span className="font-body text-[11px] text-muted-foreground/70 truncate">
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
