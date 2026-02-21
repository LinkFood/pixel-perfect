import { useState } from "react";
import { useChainLog } from "@/hooks/useChainLog";
import ChainLogPanel from "./ChainLogPanel";

type Phase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

interface DevStatusBarProps {
  phase: Phase;
  dbStatus?: string;
  mood?: string | null;
  photoCount: number;
  projectId?: string | null;
}

const phaseColors: Record<Phase, string> = {
  home: "bg-muted text-muted-foreground",
  upload: "bg-blue-500/20 text-blue-300",
  "mood-picker": "bg-purple-500/20 text-purple-300",
  interview: "bg-green-500/20 text-green-300",
  generating: "bg-amber-500/20 text-amber-300",
  review: "bg-primary/20 text-primary",
};

const DevStatusBar = ({ phase, dbStatus, mood, photoCount, projectId }: DevStatusBarProps) => {
  const { events } = useChainLog();
  const [panelOpen, setPanelOpen] = useState(false);

  const totalTokens = events.reduce((sum, e) => sum + (e.tokenCount || 0), 0);
  const totalCost = events.reduce((sum, e) => sum + (e.costCents || 0), 0);
  const errorCount = events.filter(e => e.status === "error").length;

  return (
    <div className="shrink-0 z-50">
      <div className="bg-foreground/90 text-background text-[11px] font-mono px-3 py-1.5 flex items-center gap-3 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full font-bold ${phaseColors[phase]}`}>
          {phase}
        </span>
        <span>db: <strong>{dbStatus || "—"}</strong></span>
        <span>mood: <strong>{mood || "—"}</strong></span>
        <span>photos: <strong>{photoCount}</strong></span>
        {totalTokens > 0 && <span>tok: <strong>{totalTokens.toLocaleString()}</strong></span>}
        {totalCost > 0 && <span>cost: <strong>${(totalCost / 100).toFixed(2)}</strong></span>}
        {errorCount > 0 && (
          <span className="text-red-400 font-bold">⚠ {errorCount} error{errorCount !== 1 ? "s" : ""}</span>
        )}
        {projectId && (
          <span className="opacity-50 truncate max-w-[120px]">{projectId}</span>
        )}
        <button
          onClick={() => setPanelOpen(prev => !prev)}
          className={`ml-auto px-2 py-0.5 rounded text-[10px] transition-colors ${
            panelOpen ? "bg-primary/20 text-primary" : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
          }`}
        >
          🔗 Chain Log ({events.length})
        </button>
      </div>
      {panelOpen && <ChainLogPanel />}
    </div>
  );
};

export default DevStatusBar;
