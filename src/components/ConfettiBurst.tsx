import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiBurstProps {
  trigger: boolean;
  onComplete?: () => void;
}

// 24 particles: mix of tiny books (rectangles), paint splatters (circles), hearts
// Coral palette at varying opacities: hsl(16, 78%, 60%), hsl(16, 78%, 70%), hsl(16, 78%, 50%), hsl(40, 70%, 65%), hsl(350, 60%, 55%)
// Arc outward from center of viewport, gravity-like curve, fade over 2s
// z-[60] to render above everything

type Particle = {
  id: number;
  shape: "book" | "splatter" | "heart";
  color: string;
  x: number; // final x offset from center
  y: number; // final y offset from center
  rotation: number;
  scale: number;
  delay: number;
};

const COLORS = [
  "hsl(16, 78%, 60%)",  // coral primary
  "hsl(16, 78%, 70%)",  // lighter coral
  "hsl(16, 78%, 50%)",  // darker coral
  "hsl(40, 70%, 65%)",  // warm gold
  "hsl(350, 60%, 55%)", // rosy
];

const SHAPES: Particle["shape"][] = ["book", "splatter", "heart", "book", "splatter", "heart", "splatter", "book"];

function generateParticles(): Particle[] {
  return Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 120 + Math.random() * 180;
    return {
      id: i,
      shape: SHAPES[i % SHAPES.length],
      color: COLORS[i % COLORS.length],
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 40, // bias upward slightly
      rotation: Math.random() * 360,
      scale: 0.6 + Math.random() * 0.6,
      delay: Math.random() * 0.3,
    };
  });
}

function ParticleShape({ shape, color }: { shape: Particle["shape"]; color: string }) {
  if (shape === "book") {
    return (
      <svg width="14" height="12" viewBox="0 0 14 12">
        <rect x="1" y="1" width="12" height="10" rx="1" fill={color} />
        <line x1="7" y1="1" x2="7" y2="11" stroke="white" strokeWidth="0.5" opacity="0.4" />
      </svg>
    );
  }
  if (shape === "splatter") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" fill={color} />
      </svg>
    );
  }
  // heart
  return (
    <svg width="12" height="11" viewBox="0 0 12 11">
      <path d="M6 10 C6 10, 0 6, 0 3.5 C0 1.5, 1.5 0, 3 0 C4.2 0, 5.4 0.8, 6 2 C6.6 0.8, 7.8 0, 9 0 C10.5 0, 12 1.5, 12 3.5 C12 6, 6 10, 6 10Z" fill={color} />
    </svg>
  );
}

const ConfettiBurst = ({ trigger, onComplete }: ConfettiBurstProps) => {
  const [active, setActive] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger && !active) {
      setActive(true);
      setParticles(generateParticles());
      const timeout = setTimeout(() => {
        setActive(false);
        setParticles([]);
        onComplete?.();
      }, 2500);
      return () => clearTimeout(timeout);
    }
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
          <div className="absolute top-1/2 left-1/2">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                animate={{
                  x: p.x,
                  y: p.y,
                  opacity: [1, 1, 0],
                  scale: [0, p.scale, p.scale * 0.5],
                  rotate: p.rotation,
                }}
                transition={{
                  duration: 2,
                  delay: p.delay,
                  ease: [0.25, 0.46, 0.45, 0.94],
                  opacity: { duration: 2, times: [0, 0.6, 1] },
                }}
                className="absolute"
                style={{ marginLeft: -6, marginTop: -6 }}
              >
                <ParticleShape shape={p.shape} color={p.color} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfettiBurst;
