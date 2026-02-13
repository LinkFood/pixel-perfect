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
    color: "#F59E0B",
  },
  {
    key: "heartfelt",
    label: "Make it heartfelt",
    description: "The deep bond & quiet moments",
    icon: Heart,
    color: "#EC4899",
  },
  {
    key: "adventure",
    label: "Tell an adventure",
    description: "Wild times & mischief",
    icon: Compass,
    color: "#3B82F6",
  },
  {
    key: "memorial",
    label: "Honor their memory",
    description: "Celebrating a life well-lived",
    icon: Star,
    color: "#8B5CF6",
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

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      {/* Rabbit prompt */}
      <div className="flex items-start gap-3 max-w-md">
        <div className="shrink-0 mt-1">
          <RabbitCharacter state="idle" size={32} />
        </div>
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 font-body text-sm bg-card text-foreground">
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
          className="w-full rounded-xl border-2 px-4 py-3 font-body text-sm outline-none transition-colors border-border bg-white text-foreground focus:border-primary"
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
          return (
            <motion.button
              key={m.key}
              variants={card}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(m.key, subjectName.trim() || "My Story")}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 p-5 cursor-pointer transition-colors border-border bg-white"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = m.color;
                (e.currentTarget as HTMLElement).style.background = `${m.color}08`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "";
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              <Icon className="w-7 h-7" style={{ color: m.color }} />
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
