import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Heart, Compass, Star } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";

interface MoodPickerProps {
  petName: string;
  onSelect: (mood: string, name: string) => void;
}

const moods = [
  {
    key: "funny",
    label: "Make it funny",
    description: "Quirky moments & silly habits",
    icon: Sparkles,
    iconClass: "text-amber-500",
    glowColor: "hsl(38 92% 50% / 0.15)",
  },
  {
    key: "heartfelt",
    label: "Make it heartfelt",
    description: "The deep bond & quiet moments",
    icon: Heart,
    iconClass: "text-pink-500",
    glowColor: "hsl(330 80% 60% / 0.15)",
  },
  {
    key: "adventure",
    label: "Tell an adventure",
    description: "Wild times & mischief",
    icon: Compass,
    iconClass: "text-blue-500",
    glowColor: "hsl(210 80% 55% / 0.15)",
  },
  {
    key: "memorial",
    label: "Honor their memory",
    description: "Celebrating a life well-lived",
    icon: Star,
    iconClass: "text-violet-500",
    glowColor: "hsl(270 70% 55% / 0.15)",
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

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      {/* Rabbit prompt */}
      <div className="flex items-start gap-3 max-w-md">
        <div className="shrink-0 mt-1">
          <RabbitCharacter state="idle" size={32} />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 font-body text-sm glass-warm glow-soft text-foreground">
          Great photos! Give me a name, pick a mood, and let's make something.
        </div>
      </div>

      {/* Name input */}
      <div className="w-full max-w-md">
        <input
          type="text"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          placeholder="e.g. Max, Mom, Our Trip to Japan..."
          className="w-full rounded-xl border border-border/60 px-4 py-3 font-body text-sm outline-none transition-all shadow-chat glass-warm text-foreground focus:border-primary/30 focus:glow-primary"
          autoFocus
        />
        <p className="font-body text-xs mt-1.5 text-center text-muted-foreground">
          A pet, person, place, or memory
        </p>
      </div>

      {/* 2x2 grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 w-full max-w-md"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {moods.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMood === m.key;
          return (
            <motion.button
              key={m.key}
              variants={card}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setSelectedMood(m.key);
                onSelect(m.key, subjectName.trim() || "My Story");
              }}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-5 cursor-pointer transition-all glass-warm ${
                isSelected
                  ? "border-primary/50 glow-primary"
                  : "border-border/40 hover:border-primary/30"
              }`}
              animate={isSelected ? { scale: [1, 1.05, 1] } : {}}
              transition={isSelected ? { duration: 0.3 } : {}}
              style={
                isSelected
                  ? { boxShadow: `0 0 24px ${m.glowColor}` }
                  : undefined
              }
              onHoverStart={undefined}
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
    </div>
  );
};

export default MoodPicker;
