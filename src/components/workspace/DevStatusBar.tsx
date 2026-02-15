import { isDevMode } from "@/lib/devMode";

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
  if (!isDevMode()) return null;

  return (
    <div className="bg-foreground/90 text-background text-[11px] font-mono px-3 py-1.5 flex items-center gap-3 flex-wrap shrink-0 z-50">
      <span className={`px-2 py-0.5 rounded-full font-bold ${phaseColors[phase]}`}>
        {phase}
      </span>
      <span>db: <strong>{dbStatus || "—"}</strong></span>
      <span>mood: <strong>{mood || "—"}</strong></span>
      <span>photos: <strong>{photoCount}</strong></span>
      {projectId && (
        <span className="opacity-50 truncate max-w-[120px]">{projectId}</span>
      )}
    </div>
  );
};

export default DevStatusBar;
