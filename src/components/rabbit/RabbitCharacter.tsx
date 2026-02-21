import { forwardRef, useEffect, useRef, useState } from "react";
import { motion, useAnimation, useReducedMotion, type Variants } from "framer-motion";

export type RabbitState =
  | "idle"
  | "listening"
  | "excited"
  | "thinking"
  | "painting"
  | "presenting"
  | "celebrating"
  | "sympathetic"
  | "sleeping";

interface RabbitCharacterProps {
  state?: RabbitState;
  size?: number;
  className?: string;
  eyeOffset?: { x: number; y: number };
  mood?: string;
}

// ─── Mood → subtle tint color ────────────────────────────────
const MOOD_TINTS: Record<string, string> = {
  heartfelt: "hsl(350, 60%, 65%)",   // soft rose
  sweet: "hsl(350, 60%, 65%)",       // soft rose
  memorial: "hsl(350, 60%, 65%)",    // soft rose
  adventure: "hsl(175, 50%, 50%)",   // cool blue-green
  funny: "hsl(25, 80%, 55%)",        // warm orange
  roast: "hsl(25, 80%, 55%)",        // warm orange
};
const CUSTOM_MOOD_TINT = "hsl(270, 45%, 60%)"; // soft violet

function getMoodTint(mood?: string): string | null {
  if (!mood) return null;
  if (mood.startsWith("custom:")) return CUSTOM_MOOD_TINT;
  return MOOD_TINTS[mood] || null;
}

// ─── Color palette — gritty but warm ───────────────────────
const C = {
  body: "#E8DDD2",
  bodyStroke: "#8B7355",
  innerEar: "#D4A08A",
  eye: "#1A1410",
  eyeHighlight: "#FFFFFF",
  nose: "#3D2B1F",
  blush: "#D4836A",
  scar: "#B8956E",
  bandage: "#F0E6D8",
  bandageStripe: "#D4B896",
  belly: "#F2EAE0",
  whisker: "#8B7355",
  shadow: "#6B5840",
};

// ─── Blink logic ────────────────────────────────────────────
function useBlinkLoop(reduceMotion: boolean | null) {
  const controls = useAnimation();
  const timeoutRef = useRef<number>();

  useEffect(() => {
    if (reduceMotion) return;
    let mounted = true;

    const blink = async () => {
      if (!mounted) return;
      await controls.start({ scaleY: 0.1, transition: { duration: 0.06 } });
      await controls.start({ scaleY: 1, transition: { duration: 0.08 } });
      if (Math.random() < 0.25) {
        await new Promise(r => setTimeout(r, 100));
        await controls.start({ scaleY: 0.1, transition: { duration: 0.06 } });
        await controls.start({ scaleY: 1, transition: { duration: 0.08 } });
      }
      if (mounted) {
        timeoutRef.current = window.setTimeout(blink, 2200 + Math.random() * 2800);
      }
    };

    timeoutRef.current = window.setTimeout(blink, 1200 + Math.random() * 1500);
    return () => {
      mounted = false;
      clearTimeout(timeoutRef.current);
    };
  }, [controls, reduceMotion]);

  return controls;
}

// ─── Body bounce variants per state ─────────────────────────
const bodyVariants: Variants = {
  idle: {
    y: [0, -2, 0],
    transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    y: -4,
    rotate: -1.5,
    transition: { type: "spring", stiffness: 220, damping: 15 },
  },
  excited: {
    y: [0, -16, 0, -8, 0],
    scale: [1, 1.04, 0.97, 1.02, 1],
    transition: { duration: 0.55, repeat: Infinity, repeatDelay: 0.7 },
  },
  thinking: {
    rotate: [0, 2, -1.5, 0],
    y: -1,
    transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
  },
  painting: {
    rotate: -3,
    y: -2,
    transition: { type: "spring", stiffness: 150 },
  },
  presenting: {
    y: -6,
    scale: 1.04,
    transition: { type: "spring", stiffness: 200, damping: 12 },
  },
  celebrating: {
    y: [0, -22, 0, -12, 0],
    rotate: [0, -4, 4, -2, 0],
    scale: [1, 1.08, 0.96, 1.04, 1],
    transition: { duration: 0.7, repeat: Infinity, repeatDelay: 0.9 },
  },
  sympathetic: {
    y: 2,
    rotate: -2,
    transition: { type: "spring", stiffness: 100 },
  },
  sleeping: {
    y: 5,
    rotate: -6,
    transition: { type: "spring", stiffness: 50 },
  },
};

// ─── Ear variants ───────────────────────────────────────────
const leftEarVariants: Variants = {
  idle: {
    rotate: [0, -2, 0, 1, 0],
    transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
  },
  listening: { rotate: -6, transition: { type: "spring", stiffness: 300 } },
  excited: {
    rotate: [0, -8, 4, -6, 0],
    transition: { duration: 0.45, repeat: Infinity, repeatDelay: 0.5 },
  },
  thinking: { rotate: -4, transition: { duration: 0.4 } },
  painting: { rotate: -3, transition: { duration: 0.3 } },
  presenting: { rotate: -10, transition: { type: "spring", stiffness: 300 } },
  celebrating: {
    rotate: [0, -12, 8, -10, 0],
    transition: { duration: 0.5, repeat: Infinity },
  },
  sympathetic: { rotate: 4, transition: { duration: 0.5 } },
  sleeping: { rotate: 12, transition: { duration: 1 } },
};

const rightEarVariants: Variants = {
  idle: {
    rotate: [0, 1, 0, -2, 0],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.4 },
  },
  listening: { rotate: 6, transition: { type: "spring", stiffness: 300 } },
  excited: {
    rotate: [0, 8, -4, 6, 0],
    transition: { duration: 0.45, repeat: Infinity, repeatDelay: 0.5, delay: 0.1 },
  },
  thinking: { rotate: 2, transition: { duration: 0.4 } },
  painting: { rotate: 1, transition: { duration: 0.3 } },
  presenting: { rotate: 10, transition: { type: "spring", stiffness: 300 } },
  celebrating: {
    rotate: [0, 12, -8, 10, 0],
    transition: { duration: 0.5, repeat: Infinity, delay: 0.1 },
  },
  sympathetic: { rotate: -4, transition: { duration: 0.5 } },
  sleeping: { rotate: -8, transition: { duration: 1 } },
};

// ─── Arm variants ───────────────────────────────────────────
const rightArmVariants: Variants = {
  idle: { rotate: 0, transition: { duration: 0.4 } },
  listening: { rotate: 0 },
  excited: {
    rotate: [0, -18, 8, -12, 0],
    transition: { duration: 0.45, repeat: Infinity, repeatDelay: 0.7 },
  },
  thinking: { rotate: -12, y: -4, transition: { duration: 0.4 } },
  painting: {
    rotate: [-12, -22, -8, -18, -12],
    transition: { duration: 1, repeat: Infinity, ease: "easeInOut" },
  },
  presenting: {
    rotate: -40,
    y: -8,
    transition: { type: "spring", stiffness: 200 },
  },
  celebrating: {
    rotate: [0, -45, 8, -35, 0],
    transition: { duration: 0.55, repeat: Infinity },
  },
  sympathetic: { rotate: 0 },
  sleeping: { rotate: 4 },
};

// ─── Left arm variants ──────────────────────────────────────
const leftArmVariants: Variants = {
  idle: { rotate: 0, transition: { duration: 0.4 } },
  listening: { rotate: 0 },
  excited: {
    rotate: [0, 18, -8, 12, 0],
    transition: { duration: 0.45, repeat: Infinity, repeatDelay: 0.7, delay: 0.15 },
  },
  thinking: { rotate: 8, y: -2, transition: { duration: 0.4 } },
  painting: { rotate: 3, transition: { duration: 0.3 } },
  presenting: {
    rotate: 30,
    y: -6,
    transition: { type: "spring", stiffness: 200 },
  },
  celebrating: {
    rotate: [0, 45, -8, 35, 0],
    transition: { duration: 0.55, repeat: Infinity, delay: 0.15 },
  },
  sympathetic: { rotate: 0 },
  sleeping: { rotate: -4 },
};

// ─── Tail wag variants ──────────────────────────────────────
const tailVariants: Variants = {
  idle: { rotate: [0, 6, -4, 0], transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } },
  listening: { rotate: 3, transition: { duration: 0.4 } },
  excited: { rotate: [-8, 8], transition: { duration: 0.25, repeat: Infinity } },
  thinking: { rotate: -3, transition: { duration: 0.4 } },
  painting: { rotate: [0, 4, 0], transition: { duration: 1.5, repeat: Infinity } },
  presenting: { rotate: 6, transition: { type: "spring", stiffness: 200 } },
  celebrating: { rotate: [-12, 12], transition: { duration: 0.2, repeat: Infinity } },
  sympathetic: { rotate: -2, transition: { duration: 0.5 } },
  sleeping: { rotate: 0, y: 3, transition: { duration: 1 } },
};

// ─── Whisker twitch variants ────────────────────────────────
const whiskerLeftVariants: Variants = {
  idle: { rotate: [0, -1.5, 0.5, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  excited: { rotate: [-3, 3], transition: { duration: 0.15, repeat: Infinity } },
  thinking: { rotate: 2, transition: { duration: 0.4 } },
  sleeping: { rotate: 5, transition: { duration: 1 } },
};
const whiskerRightVariants: Variants = {
  idle: { rotate: [0, 1.5, -0.5, 0], transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 } },
  excited: { rotate: [3, -3], transition: { duration: 0.15, repeat: Infinity, delay: 0.05 } },
  thinking: { rotate: -2, transition: { duration: 0.4 } },
  sleeping: { rotate: -5, transition: { duration: 1 } },
};

// ─── Nose wiggle variants ───────────────────────────────────
const noseVariants: Variants = {
  idle: { rotate: [0, 1, -1, 0], transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" } },
  excited: { rotate: [-2, 2], scale: 1.05, transition: { duration: 0.2, repeat: Infinity } },
  thinking: { rotate: 2, transition: { duration: 0.4 } },
  sleeping: { rotate: 0, y: 1, transition: { duration: 1 } },
};

// ─── Breathing variants ───────────────────────────────────────
const breathingVariants: Variants = {
  idle: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  excited: {
    scaleY: [1, 1.015, 1],
    transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
  },
  thinking: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  painting: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  presenting: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  celebrating: {
    scaleY: [1, 1.015, 1],
    transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
  },
  sympathetic: {
    scaleY: [1, 1.012, 1],
    transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
  },
  sleeping: {
    scaleY: [1, 1.008, 1],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
  },
};

// ─── ZZZ for sleeping ───────────────────────────────────────
const SleepZzz = forwardRef<SVGGElement>((_, ref) => (
  <g ref={ref}>
    {[0, 1, 2].map(i => (
      <motion.text
        key={i}
        x={155 + i * 12}
        y={65 - i * 18}
        fontSize={12 - i * 2}
        fill={C.shadow}
        fontFamily="Plus Jakarta Sans, sans-serif"
        fontWeight="700"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 1, 0], y: [10, -5, -15] }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" }}
      >
        z
      </motion.text>
    ))}
  </g>
));
SleepZzz.displayName = "SleepZzz";

// ─── Main Component ─────────────────────────────────────────
const RabbitCharacter = ({ state = "idle", size = 200, className, eyeOffset, mood }: RabbitCharacterProps) => {
  const shouldReduceMotion = useReducedMotion();
  const blinkControls = useBlinkLoop(shouldReduceMotion);
  const [currentState, setCurrentState] = useState(state);
  const moodTint = getMoodTint(mood);

  useEffect(() => {
    setCurrentState(state);
  }, [state]);

  const isSleeping = currentState === "sleeping";
  const isHappy = currentState === "celebrating" || currentState === "excited";
  const isPulsing = currentState === "thinking" || currentState === "painting";

  // Eye tracking — clamp offset to stay within eye bounds
  const ex = eyeOffset ? Math.max(-2.5, Math.min(2.5, eyeOffset.x * 2.5)) : 0;
  const ey = eyeOffset ? Math.max(-1.5, Math.min(1.5, eyeOffset.y * 1.5)) : 0;

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size * 1.4 }}
      animate={isPulsing && !shouldReduceMotion ? {
        scale: [1, 1.015, 1],
      } : { scale: 1 }}
      transition={isPulsing ? {
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      } : { duration: 0.3 }}
    >
      <svg
        viewBox="0 0 200 280"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <motion.g
          variants={bodyVariants}
          animate={shouldReduceMotion ? undefined : currentState}
          style={{ originX: "100px", originY: "200px" }}
        >
          {/* ── Shadow ── */}
          <ellipse cx="100" cy="268" rx="40" ry="6" fill={C.shadow} opacity="0.15" />

          {/* ── Tail — scruffier (animated wag) ── */}
          <motion.g
            variants={tailVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "150px", originY: "212px" }}
          >
            <circle cx="150" cy="212" r="9" fill={C.body} stroke={C.bodyStroke} strokeWidth="2" />
            <circle cx="153" cy="208" r="4" fill={C.belly} opacity="0.5" />
          </motion.g>

          {/* ── Body + Belly + Chest scar — breathing group ── */}
          <motion.g
            variants={breathingVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "100px", originY: "250px" }}
          >
            {/* ── Body — stockier ── */}
            <ellipse cx="100" cy="208" rx="48" ry="52" fill={C.body} stroke={C.bodyStroke} strokeWidth="2.5" />

            {/* ── Belly ── */}
            <ellipse cx="100" cy="218" rx="30" ry="32" fill={C.belly} />

            {/* ── Chest scar — subtle ── */}
            <path
              d="M88 200 C90 195, 95 193, 97 198"
              stroke={C.scar}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.4"
            />
          </motion.g>

          {/* ── Feet — chunkier ── */}
          <ellipse cx="72" cy="255" rx="22" ry="11" fill={C.body} stroke={C.bodyStroke} strokeWidth="2" />
          <ellipse cx="128" cy="255" rx="22" ry="11" fill={C.body} stroke={C.bodyStroke} strokeWidth="2" />
          {/* Toe marks — rougher */}
          <line x1="62" y1="252" x2="62" y2="259" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="70" y1="250" x2="70" y2="259" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="118" y1="252" x2="118" y2="259" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="126" y1="250" x2="126" y2="259" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" />

          {/* ── Left arm (animated) ── */}
          <motion.g
            variants={leftArmVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "56px", originY: "192px" }}
          >
            <ellipse cx="56" cy="202" rx="13" ry="21" fill={C.body} stroke={C.bodyStroke} strokeWidth="2"
              transform="rotate(-12, 56, 202)" />
          </motion.g>

          {/* ── Right arm (animated) ── */}
          <motion.g
            variants={rightArmVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "144px", originY: "192px" }}
          >
            <ellipse cx="144" cy="202" rx="13" ry="21" fill={C.body} stroke={C.bodyStroke} strokeWidth="2"
              transform="rotate(12, 144, 202)" />
          </motion.g>

          {/* ── Head — slightly squarish ── */}
          <circle cx="100" cy="130" r="46" fill={C.body} stroke={C.bodyStroke} strokeWidth="2.5" />

          {/* ── Left ear — with NOTCH (battle damage) ── */}
          <motion.g
            variants={leftEarVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "82px", originY: "90px" }}
          >
            <path
              d="M82 90 C78 65, 68 25, 72 10 C76 -2, 88 -2, 90 10 C92 20, 90 22, 86 24 C84 26, 82 24, 83 20 C84 18, 88 30, 88 65 L85 90"
              fill={C.body}
              stroke={C.bodyStroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M83 82 C80 62, 76 38, 78 22 C79 12, 86 12, 87 22 C88 35, 85 62, 84 82"
              fill={C.innerEar}
              opacity="0.5"
            />
          </motion.g>

          {/* ── Right ear — with BANDAGE wrapped around it ── */}
          <motion.g
            variants={rightEarVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "118px", originY: "90px" }}
          >
            <path
              d="M118 90 C122 65, 130 30, 128 15 C126 2, 114 0, 112 12 C108 32, 114 65, 116 90"
              fill={C.body}
              stroke={C.bodyStroke}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M117 82 C120 62, 126 35, 124 22 C123 12, 116 10, 115 20 C112 38, 115 62, 116 82"
              fill={C.innerEar}
              opacity="0.5"
            />
            {/* Bandage wraps */}
            <rect x="112" y="28" width="18" height="7" rx="2" fill={C.bandage} stroke={C.bandageStripe} strokeWidth="1" transform="rotate(-5, 121, 31)" />
            <rect x="113" y="38" width="16" height="6" rx="2" fill={C.bandage} stroke={C.bandageStripe} strokeWidth="1" transform="rotate(3, 121, 41)" />
            {/* X mark on bandage */}
            <line x1="119" y1="30" x2="123" y2="34" stroke={C.scar} strokeWidth="1.2" strokeLinecap="round" />
            <line x1="123" y1="30" x2="119" y2="34" stroke={C.scar} strokeWidth="1.2" strokeLinecap="round" />
          </motion.g>

          {/* ── Face ── */}

          {/* Scar across left eyebrow */}
          <path
            d="M72 118 C75 115, 80 114, 84 116"
            stroke={C.scar}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />

          {/* Blush — asymmetric, one side only (the tough side doesn't blush) */}
          <ellipse cx="130" cy="142" rx="9" ry="5" fill={C.blush} opacity="0.25" />

          {/* Eyes — left eye slightly squinted (the scar side) */}
          <motion.g animate={blinkControls} style={{ originX: "82px", originY: "128px" }}>
            {isSleeping ? (
              <path d="M76 128 C79 132, 85 132, 88 128" stroke={C.eye} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            ) : (
              <>
                <ellipse cx="82" cy="128" rx="5.5" ry={5} fill={C.eye} />
                <circle cx={84 + ex} cy={126 + ey} r="2" fill={C.eyeHighlight} />
                {/* Slight squint line under left eye */}
                <path d="M76 134 C78 135, 82 135, 85 134" stroke={C.bodyStroke} strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.4" />
              </>
            )}
          </motion.g>

          {/* Right eye — wider, more expressive */}
          <motion.g animate={blinkControls} style={{ originX: "118px", originY: "128px" }}>
            {isSleeping ? (
              <path d="M112 128 C115 132, 121 132, 124 128" stroke={C.eye} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            ) : (
              <>
                <ellipse cx="118" cy="128" rx="6" ry="6.5" fill={C.eye} />
                <circle cx={120.5 + ex} cy={125.5 + ey} r="2.5" fill={C.eyeHighlight} />
              </>
            )}
          </motion.g>

          {/* Nose — triangular, bolder (animated wiggle) */}
          <motion.path
            d="M96 144 L100 150 L104 144 Z"
            fill={C.nose}
            variants={noseVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "100px", originY: "147px" }}
          />

          {/* Mouth — cocky smirk, not symmetric */}
          {isHappy ? (
            <path d="M90 153 C95 160, 105 160, 110 153" stroke={C.bodyStroke} strokeWidth="2" strokeLinecap="round" fill="none" />
          ) : currentState === "sympathetic" ? (
            <path d="M94 156 C97 153, 103 153, 106 156" stroke={C.bodyStroke} strokeWidth="2" strokeLinecap="round" fill="none" />
          ) : (
            /* Default: cocky lopsided smirk */
            <path d="M92 153 C96 157, 102 157, 108 152" stroke={C.bodyStroke} strokeWidth="2" strokeLinecap="round" fill="none" />
          )}

          {/* Whiskers — thicker, more attitude (animated twitch) */}
          <motion.g
            variants={whiskerLeftVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "65px", originY: "143px" }}
          >
            <line x1="65" y1="140" x2="42" y2="136" stroke={C.whisker} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="65" y1="146" x2="40" y2="148" stroke={C.whisker} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </motion.g>
          <motion.g
            variants={whiskerRightVariants}
            animate={shouldReduceMotion ? undefined : currentState}
            style={{ originX: "135px", originY: "143px" }}
          >
            <line x1="135" y1="140" x2="158" y2="136" stroke={C.whisker} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            <line x1="135" y1="146" x2="160" y2="148" stroke={C.whisker} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </motion.g>

          {/* Sleeping ZZZs */}
          {isSleeping && <SleepZzz />}

          {/* ── Mood tint overlay — barely visible color wash ── */}
          <motion.rect
            x="50"
            y="0"
            width="100"
            height="270"
            rx="40"
            fill={moodTint || "transparent"}
            style={{ mixBlendMode: "color" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: moodTint ? 0.1 : 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            pointerEvents="none"
          />
        </motion.g>
      </svg>
    </motion.div>
  );
};

export default RabbitCharacter;
