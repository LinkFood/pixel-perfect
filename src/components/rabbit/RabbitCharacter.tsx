import { useEffect, useRef, useState } from "react";
import { motion, useAnimation, type Variants } from "framer-motion";

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
}

// ─── Color palette (matches brand) ──────────────────────────
const C = {
  body: "#F5EDE4",
  bodyStroke: "#D4B896",
  innerEar: "#EDCDB8",
  eye: "#2C2417",
  eyeHighlight: "#FFFFFF",
  nose: "#D4956A",
  blush: "#E8B4A0",
  beret: "#C4956A",
  beretHighlight: "#D4A87A",
  belly: "#FAF4ED",
  whisker: "#D4B896",
};

// ─── Blink logic ────────────────────────────────────────────
function useBlinkLoop() {
  const controls = useAnimation();
  const timeoutRef = useRef<number>();

  useEffect(() => {
    let mounted = true;

    const blink = async () => {
      if (!mounted) return;
      await controls.start({ scaleY: 0.1, transition: { duration: 0.08 } });
      await controls.start({ scaleY: 1, transition: { duration: 0.1 } });
      // Occasionally double-blink
      if (Math.random() < 0.3) {
        await new Promise(r => setTimeout(r, 120));
        await controls.start({ scaleY: 0.1, transition: { duration: 0.08 } });
        await controls.start({ scaleY: 1, transition: { duration: 0.1 } });
      }
      if (mounted) {
        timeoutRef.current = window.setTimeout(blink, 2500 + Math.random() * 3000);
      }
    };

    timeoutRef.current = window.setTimeout(blink, 1500 + Math.random() * 2000);
    return () => {
      mounted = false;
      clearTimeout(timeoutRef.current);
    };
  }, [controls]);

  return controls;
}

// ─── Body bounce variants per state ─────────────────────────
const bodyVariants: Variants = {
  idle: {
    y: [0, -3, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    y: -5,
    rotate: -2,
    transition: { type: "spring", stiffness: 200, damping: 15 },
  },
  excited: {
    y: [0, -18, 0, -10, 0],
    scale: [1, 1.05, 0.97, 1.03, 1],
    transition: { duration: 0.6, repeat: Infinity, repeatDelay: 0.8 },
  },
  thinking: {
    rotate: [0, 3, -2, 0],
    y: -2,
    transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
  },
  painting: {
    rotate: -4,
    y: -2,
    transition: { type: "spring", stiffness: 150 },
  },
  presenting: {
    y: -8,
    scale: 1.05,
    transition: { type: "spring", stiffness: 200, damping: 12 },
  },
  celebrating: {
    y: [0, -25, 0, -15, 0],
    rotate: [0, -5, 5, -3, 0],
    scale: [1, 1.1, 0.95, 1.05, 1],
    transition: { duration: 0.8, repeat: Infinity, repeatDelay: 1 },
  },
  sympathetic: {
    y: 2,
    rotate: -3,
    transition: { type: "spring", stiffness: 100 },
  },
  sleeping: {
    y: 5,
    rotate: -8,
    transition: { type: "spring", stiffness: 50 },
  },
};

// ─── Ear variants ───────────────────────────────────────────
const leftEarVariants: Variants = {
  idle: {
    rotate: [0, -3, 0, 2, 0],
    transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
  },
  listening: {
    rotate: -8,
    transition: { type: "spring", stiffness: 300 },
  },
  excited: {
    rotate: [0, -10, 5, -8, 0],
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.5 },
  },
  thinking: {
    rotate: -5,
    transition: { duration: 0.4 },
  },
  painting: {
    rotate: -4,
    transition: { duration: 0.3 },
  },
  presenting: {
    rotate: -12,
    transition: { type: "spring", stiffness: 300 },
  },
  celebrating: {
    rotate: [0, -15, 10, -12, 0],
    transition: { duration: 0.6, repeat: Infinity },
  },
  sympathetic: {
    rotate: 5,
    transition: { duration: 0.5 },
  },
  sleeping: {
    rotate: 15,
    transition: { duration: 1 },
  },
};

const rightEarVariants: Variants = {
  idle: {
    rotate: [0, 2, 0, -3, 0],
    transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
  },
  listening: {
    rotate: 8,
    transition: { type: "spring", stiffness: 300 },
  },
  excited: {
    rotate: [0, 10, -5, 8, 0],
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.5, delay: 0.1 },
  },
  thinking: {
    rotate: 3,
    transition: { duration: 0.4 },
  },
  painting: {
    rotate: 2,
    transition: { duration: 0.3 },
  },
  presenting: {
    rotate: 12,
    transition: { type: "spring", stiffness: 300 },
  },
  celebrating: {
    rotate: [0, 15, -10, 12, 0],
    transition: { duration: 0.6, repeat: Infinity, delay: 0.1 },
  },
  sympathetic: {
    rotate: -5,
    transition: { duration: 0.5 },
  },
  sleeping: {
    rotate: -10,
    transition: { duration: 1 },
  },
};

// ─── Arm variants ───────────────────────────────────────────
const rightArmVariants: Variants = {
  idle: { rotate: 0, transition: { duration: 0.4 } },
  listening: { rotate: 0 },
  excited: {
    rotate: [0, -20, 10, -15, 0],
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 0.8 },
  },
  thinking: { rotate: -15, y: -5, transition: { duration: 0.4 } },
  painting: {
    rotate: [-15, -25, -10, -20, -15],
    transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
  },
  presenting: {
    rotate: -45,
    y: -10,
    transition: { type: "spring", stiffness: 200 },
  },
  celebrating: {
    rotate: [0, -50, 10, -40, 0],
    transition: { duration: 0.6, repeat: Infinity },
  },
  sympathetic: { rotate: 0 },
  sleeping: { rotate: 5 },
};

// ─── ZZZ for sleeping ───────────────────────────────────────
const SleepZzz = () => (
  <g>
    {[0, 1, 2].map(i => (
      <motion.text
        key={i}
        x={155 + i * 12}
        y={65 - i * 18}
        fontSize={12 - i * 2}
        fill={C.bodyStroke}
        fontFamily="DM Sans, sans-serif"
        fontWeight="600"
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: [0, 1, 0],
          y: [10, -5, -15],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: i * 0.6,
          ease: "easeInOut",
        }}
      >
        z
      </motion.text>
    ))}
  </g>
);

// ─── Main Component ─────────────────────────────────────────
const RabbitCharacter = ({ state = "idle", size = 200, className }: RabbitCharacterProps) => {
  const blinkControls = useBlinkLoop();
  const [currentState, setCurrentState] = useState(state);

  useEffect(() => {
    setCurrentState(state);
  }, [state]);

  const isSleeping = currentState === "sleeping";

  return (
    <div className={className} style={{ width: size, height: size * 1.4 }}>
      <svg
        viewBox="0 0 200 280"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Whole body group — animated per state */}
        <motion.g
          variants={bodyVariants}
          animate={currentState}
          style={{ originX: "100px", originY: "200px" }}
        >
          {/* ── Shadow ── */}
          <ellipse cx="100" cy="268" rx="45" ry="8" fill="#E8DFD3" opacity="0.5" />

          {/* ── Tail ── */}
          <circle cx="148" cy="210" r="10" fill={C.body} stroke={C.bodyStroke} strokeWidth="1.5" />

          {/* ── Body ── */}
          <ellipse cx="100" cy="205" rx="50" ry="55" fill={C.body} stroke={C.bodyStroke} strokeWidth="2" />

          {/* ── Belly ── */}
          <ellipse cx="100" cy="215" rx="32" ry="35" fill={C.belly} />

          {/* ── Feet ── */}
          <ellipse cx="72" cy="255" rx="20" ry="10" fill={C.body} stroke={C.bodyStroke} strokeWidth="1.5" />
          <ellipse cx="128" cy="255" rx="20" ry="10" fill={C.body} stroke={C.bodyStroke} strokeWidth="1.5" />
          {/* Toe lines */}
          <line x1="64" y1="252" x2="64" y2="258" stroke={C.bodyStroke} strokeWidth="1" strokeLinecap="round" />
          <line x1="72" y1="250" x2="72" y2="258" stroke={C.bodyStroke} strokeWidth="1" strokeLinecap="round" />
          <line x1="120" y1="252" x2="120" y2="258" stroke={C.bodyStroke} strokeWidth="1" strokeLinecap="round" />
          <line x1="128" y1="250" x2="128" y2="258" stroke={C.bodyStroke} strokeWidth="1" strokeLinecap="round" />

          {/* ── Left arm ── */}
          <ellipse cx="55" cy="200" rx="12" ry="20" fill={C.body} stroke={C.bodyStroke} strokeWidth="1.5"
            transform="rotate(-15, 55, 200)" />

          {/* ── Right arm (animated) ── */}
          <motion.g
            variants={rightArmVariants}
            animate={currentState}
            style={{ originX: "145px", originY: "190px" }}
          >
            <ellipse cx="145" cy="200" rx="12" ry="20" fill={C.body} stroke={C.bodyStroke} strokeWidth="1.5"
              transform="rotate(15, 145, 200)" />
          </motion.g>

          {/* ── Head ── */}
          <circle cx="100" cy="130" r="48" fill={C.body} stroke={C.bodyStroke} strokeWidth="2" />

          {/* ── Left ear ── */}
          <motion.g
            variants={leftEarVariants}
            animate={currentState}
            style={{ originX: "82px", originY: "90px" }}
          >
            {/* Outer ear */}
            <path
              d="M82 90 C78 65, 68 25, 72 10 C76 -2, 88 -2, 90 10 C94 30, 88 65, 85 90"
              fill={C.body}
              stroke={C.bodyStroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Inner ear */}
            <path
              d="M83 82 C80 62, 74 32, 76 18 C78 8, 86 8, 87 18 C90 35, 86 62, 84 82"
              fill={C.innerEar}
              opacity="0.6"
            />
          </motion.g>

          {/* ── Right ear (slightly flopped for character) ── */}
          <motion.g
            variants={rightEarVariants}
            animate={currentState}
            style={{ originX: "118px", originY: "90px" }}
          >
            <path
              d="M118 90 C122 65, 130 30, 128 15 C126 2, 114 0, 112 12 C108 32, 114 65, 116 90"
              fill={C.body}
              stroke={C.bodyStroke}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M117 82 C120 62, 126 35, 124 22 C123 12, 116 10, 115 20 C112 38, 115 62, 116 82"
              fill={C.innerEar}
              opacity="0.6"
            />
          </motion.g>

          {/* ── Beret ── */}
          <g>
            <ellipse cx="100" cy="88" rx="28" ry="10" fill={C.beret} />
            <path
              d="M72 88 C72 68, 88 60, 100 58 C112 60, 128 68, 128 88"
              fill={C.beret}
            />
            <circle cx="100" cy="58" r="5" fill={C.beretHighlight} />
            {/* Beret highlight */}
            <path
              d="M80 78 C85 72, 95 68, 100 67"
              stroke={C.beretHighlight}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity="0.5"
            />
          </g>

          {/* ── Face ── */}

          {/* Blush */}
          <ellipse cx="68" cy="142" rx="10" ry="6" fill={C.blush} opacity="0.3" />
          <ellipse cx="132" cy="142" rx="10" ry="6" fill={C.blush} opacity="0.3" />

          {/* Eyes */}
          <motion.g animate={blinkControls} style={{ originX: "82px", originY: "128px" }}>
            {isSleeping ? (
              <>
                <path d="M76 128 C79 132, 85 132, 88 128" stroke={C.eye} strokeWidth="2" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <circle cx="82" cy="128" r="6" fill={C.eye} />
                <circle cx="84" cy="126" r="2.5" fill={C.eyeHighlight} />
              </>
            )}
          </motion.g>

          <motion.g animate={blinkControls} style={{ originX: "118px", originY: "128px" }}>
            {isSleeping ? (
              <path d="M112 128 C115 132, 121 132, 124 128" stroke={C.eye} strokeWidth="2" strokeLinecap="round" fill="none" />
            ) : (
              <>
                <circle cx="118" cy="128" r="6" fill={C.eye} />
                <circle cx="120" cy="126" r="2.5" fill={C.eyeHighlight} />
              </>
            )}
          </motion.g>

          {/* Nose */}
          <path d="M97 143 L100 148 L103 143 Z" fill={C.nose} />

          {/* Mouth */}
          {currentState === "celebrating" || currentState === "excited" ? (
            <path d="M92 152 C96 158, 104 158, 108 152" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          ) : currentState === "sympathetic" ? (
            <path d="M94 155 C97 152, 103 152, 106 155" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M95 153 C98 156, 102 156, 105 153" stroke={C.bodyStroke} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          )}

          {/* Whiskers */}
          <line x1="65" y1="140" x2="45" y2="137" stroke={C.whisker} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="65" y1="145" x2="43" y2="147" stroke={C.whisker} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="135" y1="140" x2="155" y2="137" stroke={C.whisker} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
          <line x1="135" y1="145" x2="157" y2="147" stroke={C.whisker} strokeWidth="1" strokeLinecap="round" opacity="0.5" />

          {/* Sleeping ZZZs */}
          {isSleeping && <SleepZzz />}
        </motion.g>
      </svg>
    </div>
  );
};

export default RabbitCharacter;
