import { useRef, useState, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import { useIsMobile } from "@/hooks/use-mobile";
import { enableDevMode } from "@/lib/devMode";

interface HeroLandingProps {
  onPhotoDrop: (files: File[]) => void;
}

const showcaseSpreads = [
  {
    title: "The Great Sock Heist",
    text: "Max crept across the living room, eyes locked on the prize — Dad's favorite argyle sock. This was not his first heist.",
    gradient: "from-amber-100 to-orange-50",
    illustrationDesc: "A golden retriever army-crawling toward an argyle sock — tail frozen mid-wag",
  },
  {
    title: "Why Brad Can't Cook",
    text: "The smoke alarm went off for the third time. 'It's rustic,' he said. Nobody believed him.",
    gradient: "from-emerald-100 to-teal-50",
    illustrationDesc: "A smoke-filled kitchen, a bewildered man holding a spatula and something unrecognizable",
  },
  {
    title: "Grandma's Garden",
    text: "She never measured anything — not the soil, not the water, not the love. But everything grew.",
    gradient: "from-violet-100 to-indigo-50",
    illustrationDesc: "Morning light through a greenhouse, weathered hands pressing seeds into dark soil",
  },
];

const bookCovers = [
  { title: "The Great Sock Heist", excerpt: "This was not his first heist. It would not be his last.", gradient: "from-amber-200 to-orange-100", rotate: "-2deg" },
  { title: "Why Brad Can't Cook", excerpt: "'It's rustic,' he said. Nobody believed him.", gradient: "from-emerald-200 to-teal-100", rotate: "1deg" },
  { title: "Grandma's Garden", excerpt: "Everything she planted grew. Everyone left carrying something home.", gradient: "from-violet-200 to-indigo-100", rotate: "-1deg" },
  { title: "First Year of Luna", excerpt: "She arrived in winter. By spring, she owned the house.", gradient: "from-rose-200 to-pink-100", rotate: "2deg" },
];

const HeroLanding = forwardRef<HTMLDivElement, HeroLandingProps>(({ onPhotoDrop }, fwdRef) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const isMobile = useIsMobile();

  // Eye tracking
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) return;
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

  // Spread auto-rotation
  const [spreadIndex, setSpreadIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSpreadIndex(prev => (prev + 1) % showcaseSpreads.length), 5000);
    return () => clearInterval(interval);
  }, []);

  // Drop handlers
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

  const openFilePicker = () => fileInputRef.current?.click();

  const currentSpread = showcaseSpreads[spreadIndex];

  const ctaButton = (label: string) => (
    <motion.button
      type="button"
      onClick={openFilePicker}
      className="px-8 py-4 rounded-xl bg-gradient-to-r from-primary to-primary/85 text-primary-foreground font-body text-base font-semibold transition-all hover:brightness-105 active:scale-[0.99] shadow-elevated"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        boxShadow: [
          "0 0 0px hsl(var(--primary) / 0)",
          "0 0 30px hsl(var(--primary) / 0.35)",
          "0 0 0px hsl(var(--primary) / 0)",
        ],
      }}
      transition={{ boxShadow: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }}
    >
      {label}
    </motion.button>
  );

  return (
    <div
      ref={(node) => {
        (heroRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof fwdRef === "function") fwdRef(node);
        else if (fwdRef) (fwdRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={`flex-1 overflow-y-auto transition-colors duration-300 ${isDragOver ? "bg-primary/[0.03]" : ""}`}
      onMouseMove={handleMouseMove}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={e => {
        if (heroRef.current && !heroRef.current.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" multiple onChange={handleFileSelect} />

      {/* ═══ SECTION 1: HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-6 py-16 overflow-hidden">
        {/* Background book spread */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none select-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={spreadIndex}
              className={`w-[800px] h-[400px] rounded-2xl bg-gradient-to-br ${currentSpread.gradient} book-page-texture`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          </AnimatePresence>
        </div>

        <motion.div
          className="relative z-10 flex flex-col items-center text-center gap-6 max-w-2xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className={`transition-transform duration-300 ${isDragOver ? "scale-110" : ""}`}>
            <RabbitCharacter state={isDragOver ? "excited" : "idle"} size={80} eyeOffset={eyeOffset} />
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tight">
            Drop a photo.<br />Get a storybook.
          </h1>

          <p className="font-body text-lg text-muted-foreground max-w-md">
            No writing. No design. Just your photos and a few taps.
          </p>

          {ctaButton("Make your first book — it's free")}

          <p className="font-body text-xs text-muted-foreground/50">or drag photos anywhere on this page</p>
        </motion.div>
      </section>

      {/* ═══ SECTION 2: VISUAL WALKTHROUGH ═══ */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <motion.div
            className="glass-warm shadow-float rounded-2xl p-6 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0 }}
          >
            <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-lg bg-amber-200/60 border-2 border-dashed border-amber-300 flex items-center justify-center">
                <span className="text-2xl">📷</span>
              </div>
              <div className="absolute bottom-2 right-2 glass-warm rounded-lg px-3 py-1.5 shadow-chat">
                <p className="font-body text-[10px] text-foreground/80 italic">"I see a golden retriever with a stolen sock..."</p>
              </div>
            </div>
            <p className="font-display text-sm font-bold text-foreground">Drop a photo</p>
          </motion.div>

          {/* Step 2 */}
          <motion.div
            className="glass-warm shadow-float rounded-2xl p-6 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 flex flex-col items-center justify-center gap-3 p-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {["Funny", "Heartfelt", "Adventure", "Weird"].map(v => (
                  <span key={v} className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border transition-all ${v === "Funny" ? "bg-primary/15 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Picture Book", "Comic"].map(f => (
                  <span key={f} className={`px-3 py-1.5 rounded-full text-xs font-body font-medium border ${f === "Picture Book" ? "bg-primary/15 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <p className="font-display text-sm font-bold text-foreground">Tap a vibe</p>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            className="glass-warm shadow-float rounded-2xl p-6 flex flex-col items-center gap-4"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden flex shadow-elevated">
              <div className={`w-1/2 bg-gradient-to-br ${showcaseSpreads[0].gradient} book-page-texture flex items-center justify-center`}>
                <Palette className="w-8 h-8 text-foreground/15" />
              </div>
              <div className="w-1/2 bg-card book-page-texture p-3 flex flex-col justify-center border-l border-border/30">
                <p className="font-display text-[11px] font-bold text-foreground leading-tight">{showcaseSpreads[0].title}</p>
                <p className="font-body text-[9px] text-muted-foreground mt-1 italic leading-snug line-clamp-3">"{showcaseSpreads[0].text}"</p>
              </div>
            </div>
            <p className="font-display text-sm font-bold text-foreground">Get your book</p>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECTION 3: BOOK COVERS SHOWCASE ═══ */}
      <section className="px-6 py-12">
        <div className="flex gap-5 overflow-x-auto scrollbar-hide max-w-5xl mx-auto pb-4 md:justify-center">
          {bookCovers.map((book, i) => (
            <motion.div
              key={i}
              className="flex-shrink-0 w-56 h-72 rounded-2xl relative overflow-hidden book-page-texture shadow-float cursor-default"
              style={{ rotate: book.rotate }}
              whileHover={{ scale: 1.03, rotate: "0deg" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient}`} />
              <div className="relative z-10 h-full flex flex-col justify-end p-5">
                <p className="font-display text-lg font-bold text-foreground leading-tight">{book.title}</p>
                <p className="font-body text-xs text-foreground/60 italic mt-2 leading-relaxed">{book.excerpt}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 4: CLOSING CTA ═══ */}
      <section className="px-6 py-16 flex flex-col items-center text-center gap-6">
        <p className="font-display text-2xl md:text-3xl font-bold text-foreground max-w-lg leading-snug">
          Your photos already have a story.<br />Let Rabbit find it.
        </p>

        {ctaButton("Start now")}

        <RabbitCharacter state="celebrating" size={60} />
      </section>

      {/* Dev mode */}
      <div className="flex justify-center pb-3">
        <button
          onClick={() => { enableDevMode(); window.location.href = "/?dev=1"; }}
          className="font-body text-[9px] text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors"
        >
          dev
        </button>
      </div>
    </div>
  );
});

HeroLanding.displayName = "HeroLanding";

export default HeroLanding;
