import { useRef, useState, useEffect, useCallback, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Palette } from "lucide-react";
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

type Slide = "walkthrough" | "covers";

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

  // Content slide: walkthrough vs covers
  const [activeSlide, setActiveSlide] = useState<Slide>("walkthrough");
  const [coverPage, setCoverPage] = useState(0);

  // Auto-rotate between slides
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide(prev => prev === "walkthrough" ? "covers" : "walkthrough");
    }, 6000);
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

  // Cover carousel navigation
  const coversPerView = isMobile ? 2 : 4;
  const maxCoverPage = Math.max(0, Math.ceil(bookCovers.length / coversPerView) - 1);

  return (
    <div
      ref={(node) => {
        (heroRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof fwdRef === "function") fwdRef(node);
        else if (fwdRef) (fwdRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 ${isDragOver ? "bg-primary/[0.03]" : ""}`}
      onMouseMove={handleMouseMove}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={e => {
        if (heroRef.current && !heroRef.current.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" multiple onChange={handleFileSelect} />

      {/* ═══ TOP: Hero headline + Rabbit ═══ */}
      <div className="shrink-0 flex flex-col items-center text-center gap-3 pt-8 pb-4 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={`transition-transform duration-300 ${isDragOver ? "scale-110" : ""}`}>
            <RabbitCharacter state={isDragOver ? "excited" : "idle"} size={isMobile ? 56 : 72} eyeOffset={eyeOffset} />
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground leading-[1.1] tracking-tight">
            Drop a photo.<br />Get a storybook.
          </h1>
          <p className="font-body text-base text-muted-foreground max-w-md">
            No writing. No design. Just your photos and a few taps.
          </p>
        </motion.div>
      </div>

      {/* ═══ MIDDLE: Rotating content area ═══ */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4">
        {/* Slide indicator dots */}
        <div className="flex gap-2 mb-4">
          {(["walkthrough", "covers"] as Slide[]).map(s => (
            <button
              key={s}
              onClick={() => setActiveSlide(s)}
              className={`w-2 h-2 rounded-full transition-all ${activeSlide === s ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/40"}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeSlide === "walkthrough" ? (
            <motion.div
              key="walkthrough"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.35 }}
              className="flex gap-4 max-w-4xl w-full justify-center"
            >
              {/* Step 1 */}
              <div className="glass-warm shadow-float rounded-2xl p-4 flex flex-col items-center gap-2 flex-1 max-w-[200px]">
                <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center relative overflow-hidden">
                  <div className="w-12 h-12 rounded-lg bg-amber-200/60 border-2 border-dashed border-amber-300 flex items-center justify-center">
                    <span className="text-xl">📷</span>
                  </div>
                  <div className="absolute bottom-1.5 right-1.5 glass-warm rounded-lg px-2 py-1 shadow-chat">
                    <p className="font-body text-[9px] text-foreground/80 italic">"A golden retriever with a sock..."</p>
                  </div>
                </div>
                <p className="font-display text-xs font-bold text-foreground">Drop a photo</p>
              </div>

              {/* Step 2 */}
              <div className="glass-warm shadow-float rounded-2xl p-4 flex flex-col items-center gap-2 flex-1 max-w-[200px]">
                <div className="w-full aspect-[4/3] rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 flex flex-col items-center justify-center gap-2 p-3">
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {["Funny", "Heartfelt"].map(v => (
                      <span key={v} className={`px-2.5 py-1 rounded-full text-[10px] font-body font-medium border ${v === "Funny" ? "bg-primary/15 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {v}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1.5 justify-center">
                    {["Picture Book", "Comic"].map(f => (
                      <span key={f} className={`px-2.5 py-1 rounded-full text-[10px] font-body font-medium border ${f === "Picture Book" ? "bg-primary/15 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="font-display text-xs font-bold text-foreground">Tap a vibe</p>
              </div>

              {/* Step 3 */}
              <div className="glass-warm shadow-float rounded-2xl p-4 flex flex-col items-center gap-2 flex-1 max-w-[200px]">
                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden flex shadow-elevated">
                  <div className={`w-1/2 bg-gradient-to-br ${showcaseSpreads[0].gradient} book-page-texture flex items-center justify-center`}>
                    <Palette className="w-6 h-6 text-foreground/15" />
                  </div>
                  <div className="w-1/2 bg-card book-page-texture p-2 flex flex-col justify-center border-l border-border/30">
                    <p className="font-display text-[10px] font-bold text-foreground leading-tight">{showcaseSpreads[0].title}</p>
                    <p className="font-body text-[8px] text-muted-foreground mt-0.5 italic leading-snug line-clamp-2">"{showcaseSpreads[0].text}"</p>
                  </div>
                </div>
                <p className="font-display text-xs font-bold text-foreground">Get your book</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="covers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.35 }}
              className="flex items-center gap-3 max-w-4xl w-full justify-center"
            >
              {maxCoverPage > 0 && (
                <button
                  onClick={() => setCoverPage(p => Math.max(0, p - 1))}
                  disabled={coverPage === 0}
                  className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <div className="flex gap-4 justify-center">
                {bookCovers.slice(coverPage * coversPerView, coverPage * coversPerView + coversPerView).map((book, i) => (
                  <motion.div
                    key={book.title}
                    className="w-40 h-52 rounded-2xl relative overflow-hidden book-page-texture shadow-float cursor-default shrink-0"
                    style={{ rotate: book.rotate }}
                    whileHover={{ scale: 1.03, rotate: "0deg" }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${book.gradient}`} />
                    <div className="relative z-10 h-full flex flex-col justify-end p-4">
                      <p className="font-display text-sm font-bold text-foreground leading-tight">{book.title}</p>
                      <p className="font-body text-[10px] text-foreground/60 italic mt-1 leading-relaxed">{book.excerpt}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              {maxCoverPage > 0 && (
                <button
                  onClick={() => setCoverPage(p => Math.min(maxCoverPage, p + 1))}
                  disabled={coverPage >= maxCoverPage}
                  className="shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ BOTTOM: Pinned CTA ═══ */}
      <div className="shrink-0 flex flex-col items-center gap-2 pb-6 pt-3 px-6">
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
          Make your first book — it's free
        </motion.button>
        <p className="font-body text-xs text-muted-foreground/50">or drag photos anywhere on this page</p>

        {/* Dev mode */}
        <button
          onClick={() => { enableDevMode(); window.location.href = "/?dev=1"; }}
          className="font-body text-[9px] text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors mt-1"
        >
          dev
        </button>
      </div>
    </div>
  );
});

HeroLanding.displayName = "HeroLanding";

export default HeroLanding;
