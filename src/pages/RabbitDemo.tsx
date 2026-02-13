import { useState } from "react";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";

const states: RabbitState[] = [
  "idle",
  "listening",
  "excited",
  "thinking",
  "painting",
  "presenting",
  "celebrating",
  "sympathetic",
  "sleeping",
];

const RabbitDemo = () => {
  const [state, setState] = useState<RabbitState>("idle");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background">
      <RabbitCharacter state={state} size={200} />

      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {states.map(s => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`px-4 py-2 rounded-xl text-sm font-body font-medium transition-all border ${
              state === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="font-body text-sm text-muted-foreground">
        Click a state to see the rabbit react
      </p>
    </div>
  );
};

export default RabbitDemo;
