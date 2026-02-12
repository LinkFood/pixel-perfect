import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, SkipForward, StopCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "./ChatMessage";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateProjectStatus } from "@/hooks/useProject";
import { toast } from "sonner";

type Phase = "loading" | "story" | "illustrations" | "done" | "failed";

interface GenerationViewProps {
  projectId: string;
  petName: string;
  onComplete: () => void;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const variantPersonalityMessages = [
  "Getting the colors just right...",
  "This one's going to be special...",
  "A little more detail here...",
  "The light in this scene is perfect...",
  "Adding some extra magic...",
];

const illustrationCycleStates: RabbitState[] = [
  "painting", "thinking", "excited", "painting", "listening", "painting",
];

const GenerationView = ({ projectId, petName, onComplete }: GenerationViewProps) => {
  const updateStatus = useUpdateProjectStatus();
  const [phase, setPhase] = useState<Phase>("loading");
  const [rabbitState, setRabbitState] = useState<RabbitState>("thinking");
  const [rabbitMessages, setRabbitMessages] = useState<string[]>([]);
  const [completedIllustrations, setCompletedIllustrations] = useState<string[]>([]); // URLs
  const [totalPages, setTotalPages] = useState(0);
  const [illustrationsGenerated, setIllustrationsGenerated] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [latestIllustration, setLatestIllustration] = useState<string | null>(null);
  const startedRef = useRef(false);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>();
  const prevIllCountRef = useRef(0);
  const spotlightActiveRef = useRef(false);
  const variantCountRef = useRef(0);

  // Derived step from phase
  const currentStep = phase === "story" || phase === "loading" ? 1
    : phase === "illustrations" ? 2 : 3;

  const addMessage = useCallback((msg: string) => {
    setRabbitMessages(prev => [...prev, msg]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  // ─── Elapsed timer ───────────────────────────────────────────
  useEffect(() => {
    if (phase === "story" || phase === "illustrations") {
      if (!timerRef.current) {
        timerRef.current = window.setInterval(() => {
          setElapsedSeconds(prev => prev + 1);
        }, 1000);
      }
    }
    if (phase === "done" || phase === "failed") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [phase]);

  // ─── Rabbit personality cycling during illustration phase ────
  useEffect(() => {
    if (phase !== "illustrations") return;
    let idx = 0;
    const timer = setInterval(() => {
      if (spotlightActiveRef.current) return;
      idx = (idx + 1) % illustrationCycleStates.length;
      setRabbitState(illustrationCycleStates[idx]);
    }, 8000);
    return () => clearInterval(timer);
  }, [phase]);

  // ─── Rabbit personality flashes during story phase ───────────
  useEffect(() => {
    if (phase !== "story") return;
    const flash1 = setTimeout(() => {
      setRabbitState("excited");
      setTimeout(() => setRabbitState("thinking"), 2000);
    }, 10000);
    const flash2 = setTimeout(() => {
      setRabbitState("painting");
      setTimeout(() => setRabbitState("thinking"), 3000);
    }, 25000);
    return () => { clearTimeout(flash1); clearTimeout(flash2); };
  }, [phase]);

  // Story phase rotating messages
  const storyMessages = [
    `Reading everything you shared about ${petName}...`,
    `Getting to know ${petName}'s personality...`,
    `Crafting the narrative arc...`,
    `Weaving your memories into prose...`,
    `Writing the story page by page...`,
    `Choosing the perfect words...`,
    `Polishing ${petName}'s story...`,
  ];

  useEffect(() => {
    if (phase !== "story") return;
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % storyMessages.length;
      setRabbitMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = storyMessages[idx];
        return updated;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: listen for new illustrations + spotlight logic
  useEffect(() => {
    const channel = supabase
      .channel(`gen-illustrations-${projectId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "project_illustrations",
        filter: `project_id=eq.${projectId}`,
      }, async () => {
        // Fetch latest selected illustrations
        const { data } = await supabase
          .from("project_illustrations")
          .select("page_id, storage_path")
          .eq("project_id", projectId)
          .eq("is_selected", true);
        if (data) {
          const urls = data.map(ill => {
            const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
            return urlData.publicUrl;
          });
          setCompletedIllustrations(urls);
          setIllustrationsGenerated(data.length);

          // New illustration arrived — set as persistent hero
          if (data.length > prevIllCountRef.current && urls.length > 0) {
            setLatestIllustration(urls[urls.length - 1]);
            spotlightActiveRef.current = true;
            setRabbitState("presenting");
            // Let rabbit cycle resume after a beat
            setTimeout(() => { spotlightActiveRef.current = false; }, 4000);
          }
          prevIllCountRef.current = data.length;
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Generate missing illustrations
  const generateIllustrations = useCallback(async () => {
    const { data: pages } = await supabase
      .from("project_pages")
      .select("id, page_number, page_type")
      .eq("project_id", projectId)
      .order("page_number");

    if (!pages || pages.length === 0) return;

    const { data: existing } = await supabase
      .from("project_illustrations")
      .select("page_id")
      .eq("project_id", projectId);

    // Count existing per page for variant tracking
    const { data: allExisting } = await supabase
      .from("project_illustrations")
      .select("page_id")
      .eq("project_id", projectId);
    const countByPage = new Map<string, number>();
    (allExisting || []).forEach(i => {
      countByPage.set(i.page_id, (countByPage.get(i.page_id) || 0) + 1);
    });

    const VARIANTS = 3;
    type WorkItem = { page: typeof pages[0]; isVariant: boolean };
    const work: WorkItem[] = [];
    for (const page of pages) {
      const existing = countByPage.get(page.id) || 0;
      const needed = Math.max(0, VARIANTS - existing);
      for (let v = 0; v < needed; v++) {
        work.push({ page, isVariant: v > 0 || existing > 0 });
      }
    }

    setTotalPages(pages.length);
    if (work.length === 0) {
      setPhase("done");
      setRabbitState("celebrating");
      addMessage(`${petName}'s book is ready! Take a look!`);
      updateStatus.mutate({ id: projectId, status: "review" });
      return;
    }

    setPhase("illustrations");
    setRabbitState("painting");
    addMessage(`Now I'm going to paint ${petName}'s story. This is my favorite part!`);

    let successes = 0;
    let batchDelay = 1500;
    variantCountRef.current = 0;

    for (let i = 0; i < work.length; i++) {
      if (cancelRef.current) break;

      const { page, isVariant } = work[i];
      const label = page.page_type === "cover" ? "the cover"
        : page.page_type === "dedication" ? "the dedication"
        : `page ${page.page_number}`;

      if (!isVariant) {
        addMessage(`Painting ${label}...`);
        variantCountRef.current = 0;
      } else {
        variantCountRef.current++;
        if (variantCountRef.current % 5 === 0) {
          const personalityMsg = variantPersonalityMessages[
            Math.floor(Math.random() * variantPersonalityMessages.length)
          ].replace("{petName}", petName);
          addMessage(personalityMsg);
        }
      }

      try {
        const { error } = await supabase.functions.invoke("generate-illustration", {
          body: { pageId: page.id, projectId, variant: isVariant },
        });
        if (!error) {
          successes++;
          countByPage.set(page.id, (countByPage.get(page.id) || 0) + 1);
          if (!isVariant) {
            setRabbitState("presenting");
            addMessage(`Look at this one!`);
            setTimeout(() => setRabbitState("painting"), 2000);
          }
        } else {
          const msg = typeof error === "object" && error.message ? error.message : String(error);
          if (msg.includes("429")) {
            batchDelay = Math.min(batchDelay * 2, 6000);
          }
        }
      } catch {
        // continue
      }

      if (i + 1 < work.length) await sleep(batchDelay);
      if (batchDelay > 1500) batchDelay = Math.max(batchDelay - 500, 1500);
    }

    const remaining = work.length - successes;
    if (remaining > 0) {
      setFailedCount(remaining);
      setPhase("failed");
      setRabbitState("sympathetic");
      addMessage(`A few illustrations didn't come out right. You can retry them or continue.`);
    } else {
      setPhase("done");
      setRabbitState("celebrating");
      addMessage(`${petName}'s book is ready! Take a look!`);
      updateStatus.mutate({ id: projectId, status: "review" });
    }
  }, [projectId, petName, updateStatus, addMessage]);

  // Main generation pipeline
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // Check for existing pages (resume logic)
      const { data: existingPages } = await supabase
        .from("project_pages")
        .select("id")
        .eq("project_id", projectId);

      if (existingPages && existingPages.length > 0) {
        setTotalPages(existingPages.length);
        await generateIllustrations();
        return;
      }

      // Phase 1: Story
      setPhase("story");
      setRabbitState("thinking");
      addMessage(`Let me read through everything you shared about ${petName}...`);

      const { error: storyErr } = await supabase.functions.invoke("generate-story", {
        body: { projectId },
      });

      if (storyErr) {
        setPhase("failed");
        setRabbitState("sympathetic");
        addMessage("Something went wrong with the story. Let me try again if you'd like.");
        return;
      }

      addMessage(`${petName}'s story is written! Now let me illustrate it...`);

      // Phase 2: Illustrations
      await generateIllustrations();
    };

    run();
  }, [projectId, generateIllustrations, addMessage, petName]);

  const handleRetry = () => {
    cancelRef.current = false;
    setFailedCount(0);
    generateIllustrations();
  };

  const handleStop = () => {
    cancelRef.current = true;
    toast.info("Stopping after current illustration...");
  };

  // ─── Step tracker rendering ──────────────────────────────────
  const steps = [
    { label: "Writing Story", step: 1 },
    { label: "Painting Illustrations", step: 2, count: phase === "illustrations" ? `(${illustrationsGenerated}/${totalPages})` : undefined },
    { label: "Finishing Up", step: 3 },
  ];

  const progressPercent = totalPages > 0 ? (illustrationsGenerated / totalPages) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Rabbit at top */}
      <div className="flex justify-center py-4">
        <RabbitCharacter state={rabbitState} size={140} />
      </div>

      {/* Step tracker */}
      <div className="px-4 md:px-0 pb-3 shrink-0">
        <div className="flex items-center justify-center gap-0">
          {steps.map((s, i) => {
            const isActive = currentStep === s.step;
            const isComplete = currentStep > s.step || phase === "done";
            return (
              <div key={s.step} className="flex items-center">
                {i > 0 && (
                  <div
                    className="w-8 h-0.5 mx-1"
                    style={{ background: isComplete || isActive ? "#C4956A" : "#E8D5C0" }}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-body font-semibold shrink-0"
                    style={{
                      background: isComplete ? "#4CAF50" : isActive ? "#C4956A" : "#E8D5C0",
                      color: isComplete || isActive ? "white" : "#9B8E7F",
                    }}
                  >
                    {isComplete ? <Check className="w-3.5 h-3.5" /> : s.step}
                  </div>
                  <span
                    className="font-body text-xs whitespace-nowrap"
                    style={{ color: isActive ? "#C4956A" : isComplete ? "#4CAF50" : "#9B8E7F" }}
                  >
                    {s.label}
                    {s.count && <span className="ml-0.5">{s.count}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar under step 2 */}
        {phase === "illustrations" && totalPages > 0 && (
          <div className="mt-2 max-w-xs mx-auto">
            <Progress
              value={progressPercent}
              className="h-2 rounded-full"
              style={{ background: "#F5EDE4" }}
            />
          </div>
        )}
      </div>

      {/* Narrated messages + illustration reveals */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
        {rabbitMessages.map((msg, i) => (
          <ChatMessage key={`${i}-${msg.slice(0, 20)}`} role="rabbit" content={msg} />
        ))}

        {/* Latest illustration — persistent hero */}
        <AnimatePresence mode="wait">
          {latestIllustration && (
            <motion.div
              key={latestIllustration}
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="flex justify-center py-3"
            >
              <div
                className="rounded-2xl overflow-hidden shadow-lg border-2 w-full"
                style={{ borderColor: "#C4956A", maxWidth: 380 }}
              >
                <img
                  src={latestIllustration}
                  alt="Latest illustration"
                  className="w-full h-auto object-cover"
                />
                <div
                  className="px-3 py-2 flex items-center justify-between"
                  style={{ background: "#FAF4ED" }}
                >
                  <span className="font-body text-xs font-medium" style={{ color: "#C4956A" }}>
                    Page {illustrationsGenerated} of {totalPages}
                  </span>
                  <span className="font-body text-xs" style={{ color: "#9B8E7F" }}>
                    Just painted
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Previous illustrations — medium gallery row */}
        {completedIllustrations.length > 1 && (
          <div className="py-2">
            <p className="font-body text-xs mb-2" style={{ color: "#9B8E7F" }}>
              Completed pages
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <AnimatePresence>
                {completedIllustrations.slice(0, -1).map((url, i) => (
                  <motion.div
                    key={url}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border"
                    style={{ borderColor: "#E8D5C0" }}
                  >
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Pulse indicator + timer (replaces old Loader2 spinner) */}
        {(phase === "story" || phase === "illustrations") && (
          <div className="flex items-center gap-3 py-2">
            <motion.div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: "#C4956A" }}
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-body text-xs" style={{ color: "#9B8E7F" }}>
              {phase === "story" ? "Writing story" : "Painting illustrations"}
            </span>
            <span className="font-body text-xs ml-auto" style={{ color: "#B8A99A" }}>
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 md:px-0 pb-4 flex items-center justify-center gap-3">
        {(phase === "story" || phase === "illustrations") && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            onClick={handleStop}
            style={{ borderColor: "#E8D5C0" }}
          >
            <StopCircle className="w-4 h-4" /> Stop
          </Button>
        )}
        {phase === "illustrations" && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => {
              cancelRef.current = true;
              updateStatus.mutate({ id: projectId, status: "review" });
              onComplete();
            }}
            style={{ borderColor: "#E8D5C0" }}
          >
            <SkipForward className="w-4 h-4" /> Skip to Review
          </Button>
        )}
        {phase === "failed" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={handleRetry}
              style={{ borderColor: "#E8D5C0" }}
            >
              <RefreshCw className="w-4 h-4" /> Retry {failedCount} Failed
            </Button>
            <Button
              size="sm"
              className="rounded-xl gap-2"
              style={{ background: "#C4956A", color: "white" }}
              onClick={() => {
                updateStatus.mutate({ id: projectId, status: "review" });
                onComplete();
              }}
            >
              Continue to Review
            </Button>
          </>
        )}
        {phase === "done" && (
          <Button
            size="sm"
            className="rounded-xl gap-2"
            style={{ background: "#C4956A", color: "white" }}
            onClick={onComplete}
          >
            Review Your Book
          </Button>
        )}
      </div>
    </div>
  );
};

export default GenerationView;
