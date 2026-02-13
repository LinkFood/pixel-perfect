import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, MessageCircle, BookOpen, Upload } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";

interface HeroLandingProps {
  onPhotoDrop: (files: File[]) => void;
}

const examplePages = [
  {
    title: "The Great Sock Heist",
    description: "Max crept across the living room, his golden tail low, eyes locked on the prize: Dad's favorite argyle sock.",
  },
  {
    title: "Sunrise at the Summit",
    description: "They reached the top just as the sky turned pink. Luna sat at the edge, ears forward, watching the world wake up.",
  },
  {
    title: "The Birthday Surprise",
    description: "The kitchen was covered in flour. Somehow, the cake survived. And somehow, so did the birthday girl's smile.",
  },
];

const steps = [
  { icon: Camera, label: "Upload your photos", detail: "Any photos — pets, kids, trips, anything" },
  { icon: MessageCircle, label: "Chat with Rabbit", detail: "Tell the story behind the memories" },
  { icon: BookOpen, label: "Get your book", detail: "AI writes and illustrates every page" },
];

const HeroLanding = ({ onPhotoDrop }: HeroLandingProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

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
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-6 flex flex-col items-center gap-10">

        {/* ── Hero: Rabbit + Headline ── */}
        <motion.div
          className="flex flex-col items-center gap-5 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <RabbitCharacter state="idle" size={160} />
          </motion.div>

          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight tracking-tight">
            Your photos. Their story.
            <br />
            <span className="text-primary">One beautiful book.</span>
          </h1>

          <p className="font-body text-base md:text-lg text-muted-foreground max-w-md leading-relaxed">
            Drop your favorite photos, chat with Rabbit about the memories, and watch as AI writes and illustrates a one-of-a-kind picture book.
          </p>
        </motion.div>

        {/* ── Example Book Showcase ── */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <div className="flex justify-center gap-4 md:gap-6">
            {examplePages.map((page, i) => (
              <motion.div
                key={i}
                className="w-40 md:w-48 rounded-xl bg-card border border-border/60 p-4 shadow-elevated book-page-texture"
                style={{
                  rotate: i === 0 ? -3 : i === 2 ? 3 : 0,
                  transformOrigin: "bottom center",
                }}
                whileHover={{ y: -4, scale: 1.03 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {/* Illustration placeholder — warm gradient */}
                <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-primary/10 via-secondary to-accent mb-3 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-primary/30" />
                </div>
                <p className="font-display text-xs font-semibold text-foreground leading-snug mb-1">
                  {page.title}
                </p>
                <p className="font-body text-[10px] text-muted-foreground leading-relaxed italic line-clamp-3">
                  {page.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Process Strip ── */}
        <motion.div
          className="w-full max-w-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between gap-2">
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

        {/* ── Upload CTA Drop Zone ── */}
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
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`
              w-full py-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer
              flex flex-col items-center gap-3
              ${isDragOver
                ? "border-primary bg-primary/5 glow-primary scale-[1.01]"
                : "border-primary/30 bg-primary/[0.03] hover:border-primary/50 hover:bg-primary/[0.06]"
              }
            `}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragOver ? "bg-primary/20" : "bg-primary/10"}`}>
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-body text-sm font-semibold text-foreground">
                Drop photos here to start
              </p>
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                or click to browse
              </p>
            </div>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroLanding;
