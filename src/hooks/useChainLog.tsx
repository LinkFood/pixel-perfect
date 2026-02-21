import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ChainPhase = "photo-analysis" | "appearance-profile" | "interview" | "story" | "illustration" | "pdf" | "system";
export type ChainStatus = "pending" | "running" | "success" | "error" | "skipped";

export interface ChainEvent {
  id: string;
  timestamp: Date;
  phase: ChainPhase;
  step: string;
  status: ChainStatus;
  durationMs?: number;
  input?: string;
  output?: string;
  model?: string;
  tokenCount?: number;
  costCents?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

type AddEventInput = Omit<ChainEvent, "id" | "timestamp"> & { timestamp?: Date };

interface ChainLogContextValue {
  events: ChainEvent[];
  addEvent: (partial: AddEventInput) => string;
  updateEvent: (id: string, partial: Partial<ChainEvent>) => void;
  clearLog: () => void;
}

const noop: ChainLogContextValue = {
  events: [],
  addEvent: () => "",
  updateEvent: () => {},
  clearLog: () => {},
};

const ChainLogContext = createContext<ChainLogContextValue | null>(null);

export const ChainLogProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<ChainEvent[]>([]);

  const addEvent = useCallback((partial: AddEventInput): string => {
    const id = crypto.randomUUID();
    const event: ChainEvent = {
      ...partial,
      id,
      timestamp: partial.timestamp ?? new Date(),
    };
    setEvents(prev => [...prev, event]);
    return id;
  }, []);

  const updateEvent = useCallback((id: string, partial: Partial<ChainEvent>) => {
    setEvents(prev =>
      prev.map(e => (e.id === id ? { ...e, ...partial } : e))
    );
  }, []);

  const clearLog = useCallback(() => setEvents([]), []);

  return (
    <ChainLogContext.Provider value={{ events, addEvent, updateEvent, clearLog }}>
      {children}
    </ChainLogContext.Provider>
  );
};

/** Use inside ChainLogProvider — throws if outside */
export const useChainLog = (): ChainLogContextValue => {
  const ctx = useContext(ChainLogContext);
  if (!ctx) throw new Error("useChainLog must be used within ChainLogProvider");
  return ctx;
};

/** Safe variant — returns no-ops when outside provider. Use in hooks that may run outside the workspace. */
export const useChainLogSafe = (): ChainLogContextValue => {
  const ctx = useContext(ChainLogContext);
  return ctx ?? noop;
};
