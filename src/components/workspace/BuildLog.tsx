import { useEffect, useState, useRef } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface BuildLogEntry {
  id: string;
  phase: string;
  level: string;
  message: string;
  technical_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface BuildLogProps {
  projectId: string;
}

const phaseColors: Record<string, string> = {
  story: "text-amber-500",
  illustration: "text-blue-400",
  appearance: "text-emerald-400",
  caption: "text-violet-400",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const BuildLog = ({ projectId }: BuildLogProps) => {
  const [entries, setEntries] = useState<BuildLogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch existing + subscribe to realtime
  useEffect(() => {
    // Fetch existing logs
    supabase
      .from("build_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setEntries(data as unknown as BuildLogEntry[]);
      });

    // Subscribe to new logs
    const channel = supabase
      .channel(`build-log-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "build_log",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const newEntry = payload.new as unknown as BuildLogEntry;
          setEntries((prev) => [...prev, newEntry]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [entries.length, isOpen]);

  if (entries.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
        />
        <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
          Under the Hood
        </span>
        <span className="ml-auto font-mono text-xs text-muted-foreground/60">
          {entries.length} event{entries.length !== 1 ? "s" : ""}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          ref={scrollRef}
          className="max-h-48 overflow-y-auto mt-1 rounded-xl bg-muted/30 border border-border px-3 py-2 space-y-1"
        >
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 font-mono text-[11px] leading-relaxed"
              >
                <span className="text-muted-foreground/60 shrink-0">
                  {formatTime(entry.created_at)}
                </span>
                <span className={`shrink-0 font-semibold ${phaseColors[entry.phase] || "text-muted-foreground"}`}>
                  {entry.phase}
                </span>
                <span className="text-muted-foreground">
                  {entry.technical_message || entry.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default BuildLog;
