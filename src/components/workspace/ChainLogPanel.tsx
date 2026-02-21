import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Copy, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useChainLog, type ChainEvent, type ChainPhase } from "@/hooks/useChainLog";
import { toast } from "sonner";

type FilterMode = "all" | "errors" | ChainPhase;

const PHASE_FILTERS: { label: string; value: FilterMode }[] = [
  { label: "All", value: "all" },
  { label: "Errors", value: "errors" },
  { label: "Photo", value: "photo-analysis" },
  { label: "Interview", value: "interview" },
  { label: "Story", value: "story" },
  { label: "Illustration", value: "illustration" },
  { label: "Profile", value: "appearance-profile" },
  { label: "System", value: "system" },
];

const statusColors: Record<string, string> = {
  pending: "text-gray-400",
  running: "text-yellow-400 animate-pulse",
  success: "text-green-400",
  error: "text-red-400",
  skipped: "text-gray-500",
};

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ChainLogPanel = () => {
  const { events, clearLog } = useChainLog();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "errors") return events.filter(e => e.status === "error");
    return events.filter(e => e.phase === filter);
  }, [events, filter]);

  const handleCopyAll = () => {
    const json = JSON.stringify(events, (_, v) => v instanceof Date ? v.toISOString() : v, 2);
    navigator.clipboard.writeText(json).then(() => toast.success("Chain log copied!")).catch(() => toast.error("Copy failed"));
  };

  const handleExport = () => {
    const json = JSON.stringify(events, (_, v) => v instanceof Date ? v.toISOString() : v, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `photorabbit-chain-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-950 border-t border-gray-800 font-mono text-[11px]">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 flex-wrap">
        <Filter className="w-3 h-3 text-gray-500 shrink-0" />
        {PHASE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
              filter === f.value
                ? "bg-primary/20 text-primary"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            }`}
          >
            {f.label}
            {f.value === "errors" && events.filter(e => e.status === "error").length > 0 && (
              <span className="ml-1 text-red-400">{events.filter(e => e.status === "error").length}</span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-500 hover:text-gray-300" onClick={clearLog} title="Clear">
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-500 hover:text-gray-300" onClick={handleCopyAll} title="Copy JSON">
          <Copy className="w-3 h-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-5 w-5 text-gray-500 hover:text-gray-300" onClick={handleExport} title="Export">
          <Download className="w-3 h-3" />
        </Button>
      </div>

      {/* Events */}
      <ScrollArea className="max-h-96">
        <div ref={scrollRef} className="divide-y divide-gray-800/50">
          {filtered.length === 0 && (
            <div className="px-3 py-6 text-center text-gray-600">No events yet</div>
          )}
          {filtered.map(event => (
            <EventRow
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(prev => prev === event.id ? null : event.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const EventRow = ({ event, expanded, onToggle }: { event: ChainEvent; expanded: boolean; onToggle: () => void }) => {
  const isError = event.status === "error";

  return (
    <div className={isError ? "bg-red-950/30" : ""}>
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-900/50 transition-colors"
      >
        <span className="text-gray-600 shrink-0">{formatTime(event.timestamp instanceof Date ? event.timestamp : new Date(event.timestamp))}</span>
        <span className={`uppercase font-bold text-[9px] w-14 shrink-0 ${statusColors[event.status]}`}>
          {event.status}
        </span>
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-gray-700 text-gray-400 shrink-0">
          {event.phase}
        </Badge>
        <span className="text-gray-300 truncate">› {event.step}</span>
        {event.model && <span className="text-gray-600 shrink-0">{event.model}</span>}
        {event.durationMs != null && <span className="text-gray-500 shrink-0">{formatDuration(event.durationMs)}</span>}
        {event.tokenCount != null && <span className="text-gray-500 shrink-0">{event.tokenCount}tok</span>}
        {event.costCents != null && <span className="text-gray-500 shrink-0">${(event.costCents / 100).toFixed(2)}</span>}
        {event.errorMessage && <span className="text-red-400 truncate ml-auto">{event.errorMessage}</span>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 space-y-2">
              {event.input && (
                <div>
                  <div className="text-gray-500 mb-0.5">INPUT</div>
                  <pre className="bg-gray-900 rounded p-2 text-gray-300 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
                    {event.input}
                  </pre>
                </div>
              )}
              {event.output && (
                <div>
                  <div className="text-gray-500 mb-0.5">OUTPUT</div>
                  <pre className="bg-gray-900 rounded p-2 text-gray-300 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
                    {event.output}
                  </pre>
                </div>
              )}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div>
                  <div className="text-gray-500 mb-0.5">METADATA</div>
                  <pre className="bg-gray-900 rounded p-2 text-gray-300 max-h-24 overflow-auto whitespace-pre-wrap text-[10px]">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChainLogPanel;
