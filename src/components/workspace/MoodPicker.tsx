import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Heart, Compass, Star, Pen } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";

interface MoodPickerProps {
  petName: string;
  onSelect: (mood: string, name: string) => void;
}

const moods = [
  {
    key: "funny",
    label: "Make it funny",
    description: "Laughing-till-you-cry energy",
    icon: Sparkles,
    iconClass: "text-amber-500",
  },
  {
    key: "heartfelt",
    label: "Make it heartfelt",
    description: "The deep bond & quiet moments",
    icon: Heart,
    iconClass: "text-pink-500",
  },
  {
    key: "adventure",
    label: "Tell an adventure",
    description: "Wild times & big stories",
    icon: Compass,
    iconClass: "text-blue-500",
  },
  {
    key: "memorial",
    label: "Honor their memory",
    description: "For someone who mattered",
    icon: Star,
    iconClass: "text-violet-500",
  },
  {
    key: "custom",
    label: "Your call",
    description: "Tell me the vibe",
    icon: Pen,
    iconClass: "text-primary",
  },
] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

const card = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const MoodPicker = ({ petName, onSelect }: MoodPickerProps) => {
  const [subjectName, setSubjectName] = useState(petName === "New Project" ? "" : petName);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [customVibe, setCustomVibe] = useState("");

  const effectiveMood = selectedMood === "custom" ? `custom: ${customVibe.trim()}` : selectedMood;
  const canConfirm = selectedMood && subjectName.trim() && (selectedMood !== "custom" || customVibe.trim());

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      {/* Rabbit prompt */}
      <div className="flex items-start gap-3 max-w-md">
        <div className="shrink-0 mt-1">
          <RabbitCharacter state="idle" size={32} />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 font-body text-sm glass-warm glow-soft text-foreground">
          Great photos! Give me a name, pick a vibe, and let's make something.
        </div>
      </div>

      {/* Name input */}
      <div className="w-full max-w-md">
        <input
          type="text"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          placeholder="e.g. Max, Mom, Brad, Spring Break '25..."
          maxLength={100}
          className="w-full rounded-xl border border-border/60 px-4 py-3 font-body text-sm outline-none transition-all shadow-chat glass-warm text-foreground focus:border-primary/30 focus:glow-primary"
          autoFocus
        />
        <p className="font-body text-xs mt-1.5 text-center text-muted-foreground">
          A pet, person, group, place, or moment
        </p>
      </div>

      {/* Mood grid — 2 cols, "Your call" spans full width at bottom */}
      <motion.div
        className="grid grid-cols-2 gap-3 w-full max-w-md"
        variants={container}
        initial="hidden"
        animate="show"
        role="radiogroup"
        aria-label="Choose a mood for your book"
      >
        {moods.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMood === m.key;
          const isCustom = m.key === "custom";
          return (
            <motion.button
              key={m.key}
              variants={card}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedMood(m.key)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-5 cursor-pointer transition-all glass-warm ${
                isCustom ? "col-span-2" : ""
              } ${
                isSelected
                  ? "border-primary/50 glow-primary"
                  : "border-border/40 hover:border-primary/30"
              }`}
              animate={isSelected ? { scale: [1, 1.05, 1] } : {}}
              transition={isSelected ? { duration: 0.3 } : {}}
            >
              <motion.div
                animate={isSelected ? { rotate: [0, -10, 10, 0] } : {}}
                transition={isSelected ? { duration: 0.4 } : {}}
              >
                <Icon className={`w-7 h-7 ${m.iconClass}`} />
              </motion.div>
              <span className="font-display text-base font-semibold text-foreground">
                {m.label}
              </span>
              <span className="font-body text-xs text-muted-foreground">
                {m.description}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Custom vibe input — shows when "Your call" is selected */}
      <AnimatePresence>
        {selectedMood === "custom" && (
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <input
              type="text"
              value={customVibe}
              onChange={(e) => setCustomVibe(e.target.value)}
              placeholder="e.g. roast my friend, nostalgic summer vibes, chaotic energy..."
              maxLength={200}
              className="w-full rounded-xl border border-border/60 px-4 py-3 font-body text-sm outline-none transition-all shadow-chat glass-warm text-foreground focus:border-primary/30 focus:glow-primary"
              autoFocus
            />
            <p className="font-body text-xs mt-1.5 text-center text-muted-foreground">
              Describe the vibe — Rabbit will match it
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm button */}
      <AnimatePresence>
        {canConfirm && (
          <motion.div
            className="flex flex-col items-center gap-2 w-full max-w-md"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
          >
            <motion.button
              onClick={() => onSelect(effectiveMood!, subjectName.trim())}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl px-8 py-4 text-base font-display font-semibold shadow-elevated cursor-pointer transition-colors"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              animate={{
                boxShadow: [
                  "0 0 0px hsl(var(--primary) / 0)",
                  "0 0 20px hsl(var(--primary) / 0.35)",
                  "0 0 0px hsl(var(--primary) / 0)",
                ],
              }}
              transition={{
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              Let's go!
            </motion.button>
            <p className="font-body text-xs text-muted-foreground text-center">
              This sets the tone for the whole book.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoodPicker;
