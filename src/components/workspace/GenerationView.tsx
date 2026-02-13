import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, SkipForward, StopCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "./ChatMessage";
import BuildLog from "./BuildLog";
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
    `Getting to know ${petName}...`,
    `Crafting the narrative arc...`,
    `Weaving your memories into prose...`,
    `Writing the story page by page...`,
    `Choosing the perfect words...`,
    `Polishing the story...`,
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

  // Fire variant illustrations in background (server completes regardless of unmount)
  const fireVariantsInBackground = useCallback((variantPages: { id: string }[]) => {
    variantPages.forEach((page, i) => {
      setTimeout(() => {
        supabase.functions.invoke("generate-illustration", {
          body: { pageId: page.id, projectId, variant: true },
        }).catch(() => {});
      }, i * 2500); // stagger to avoid rate limits
    });
  }, [projectId]);

  // Generate illustrations — parallel batches of 3, variants deferred to background
  const generateIllustrations = useCallback(async () => {
    const { data: pages } = await supabase
      .from("project_pages")
      .select("id, page_number, page_type")
      .eq("project_id", projectId)
      .order("page_number");

    if (!pages || pages.length === 0) return;

    // Count existing illustrations per page
    const { data: allExisting } = await supabase
      .from("project_illustrations")
      .select("page_id")
      .eq("project_id", projectId);
    const countByPage = new Map<string, number>();
    (allExisting || []).forEach(i => {
      countByPage.set(i.page_id, (countByPage.get(i.page_id) || 0) + 1);
    });

    const VARIANTS = 3;

    // Split work: initials (1 per page) vs variants (2 more per page)
    const initialWork: typeof pages = [];
    const variantPages: typeof pages = [];
    for (const page of pages) {
      const existing = countByPage.get(page.id) || 0;
      if (existing === 0) {
        initialWork.push(page);
      }
      // Variants needed after initial is done
      const afterInitial = Math.max(existing, 1);
      if (afterInitial < VARIANTS) {
        variantPages.push(page);
      }
    }

    setTotalPages(pages.length);

    // Nothing to do at all
    if (initialWork.length === 0 && variantPages.length === 0) {
      setPhase("done");
      setRabbitState("celebrating");
      addMessage(`The book is ready! Take a look!`);
      updateStatus.mutate({ id: projectId, status: "review" });
      return;
    }

    // All pages already have at least 1 — go straight to review
    if (initialWork.length === 0) {
      setPhase("done");
      setRabbitState("celebrating");
      addMessage(`The book is ready! Take a look!`);
      updateStatus.mutate({ id: projectId, status: "review" });
      fireVariantsInBackground(variantPages);
      return;
    }

    setPhase("illustrations");
    setRabbitState("painting");
    addMessage(`Now I'm going to illustrate the story. This is my favorite part!`);

    // ─── Parallel batches of 3 ──────────────────────────────────
    const CONCURRENCY = 3;
    let successes = 0;
    let failures = 0;

    for (let batch = 0; batch < initialWork.length; batch += CONCURRENCY) {
      if (cancelRef.current) break;

      const batchItems = initialWork.slice(batch, batch + CONCURRENCY);

      // Announce pages in this batch
      const labels = batchItems.map(p =>
        p.page_type === "cover" ? "the cover"
          : p.page_type === "dedication" ? "the dedication"
          : `page ${p.page_number}`
      );
      if (labels.length === 1) {
        addMessage(`Painting ${labels[0]}...`);
      } else {
        addMessage(`Painting ${labels.join(", ")}...`);
      }

      // Fire batch concurrently
      const results = await Promise.allSettled(
        batchItems.map(page =>
          supabase.functions.invoke("generate-illustration", {
            body: { pageId: page.id, projectId, variant: false },
          })
        )
      );

      let batchSuccesses = 0;
      for (const result of results) {
        if (result.status === "fulfilled" && !result.value.error) {
          batchSuccesses++;
          successes++;
        } else {
          failures++;
        }
      }

      if (batchSuccesses > 0) {
        setRabbitState("presenting");
        addMessage(batchSuccesses === 1 ? "Look at this one!" : `${batchSuccesses} more pages done!`);
        setTimeout(() => setRabbitState("painting"), 2000);
      }

      // Brief delay between batches
      if (batch + CONCURRENCY < initialWork.length) {
        await sleep(1000);
      }
    }

    // ─── Initials done — evaluate results ───────────────────────
    if (successes === 0) {
      setFailedCount(initialWork.length);
      setPhase("failed");
      setRabbitState("sympathetic");
      addMessage("The illustrations didn't come out right. You can retry or continue.");
      return;
    }

    if (failures > 0) {
      addMessage(`${failures} page${failures > 1 ? "s" : ""} didn't render, but the rest look great!`);
    }

    setPhase("done");
    setRabbitState("celebrating");
    addMessage(
      variantPages.length > 0
        ? `The book is ready! I'll keep painting more style options while you review.`
        : `The book is ready! Take a look!`
    );
    updateStatus.mutate({ id: projectId, status: "review" });

    // Fire variant generation in background — server completes even if user navigates away
    if (variantPages.length > 0) {
      fireVariantsInBackground(variantPages);
    }
  }, [projectId, petName, updateStatus, addMessage, fireVariantsInBackground]);

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

      addMessage(`The story is written! Now let me illustrate it...`);

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
                    className={`w-8 h-0.5 mx-1 ${isComplete || isActive ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-body font-semibold shrink-0 ${
                      isComplete ? "bg-green-500 text-white"
                        : isActive ? "bg-primary text-white"
                        : "bg-border text-muted-foreground"
                    }`}
                  >
                    {isComplete ? <Check className="w-3.5 h-3.5" /> : s.step}
                  </div>
                  <span
                    className={`font-body text-xs whitespace-nowrap ${
                      isActive ? "text-primary"
                        : isComplete ? "text-green-500"
                        : "text-muted-foreground"
                    }`}
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
              className="h-2 rounded-full bg-secondary"
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
                className="rounded-2xl overflow-hidden shadow-lg border-2 border-primary w-full"
                style={{ maxWidth: 380 }}
              >
                <img
                  src={latestIllustration}
                  alt="Latest illustration"
                  className="w-full h-auto object-cover"
                />
                <div className="px-3 py-2 flex items-center justify-between bg-card">
                  <span className="font-body text-xs font-medium text-primary">
                    Page {illustrationsGenerated} of {totalPages}
                  </span>
                  <span className="font-body text-xs text-muted-foreground">
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
            <p className="font-body text-xs mb-2 text-muted-foreground">
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
                    className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border"
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
              className="w-3 h-3 rounded-full shrink-0 bg-primary"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="font-body text-xs text-muted-foreground">
              {phase === "story" ? "Writing story" : "Painting illustrations"}
            </span>
            <span className="font-body text-xs ml-auto text-muted-foreground">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        )}

        {/* Build Log — collapsible "Under the Hood" */}
        <BuildLog projectId={projectId} />
      </div>

      {/* Action buttons */}
      <div className="px-4 md:px-0 pb-4 flex items-center justify-center gap-3">
        {(phase === "story" || phase === "illustrations") && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border-border"
            onClick={handleStop}
          >
            <StopCircle className="w-4 h-4" /> Stop
          </Button>
        )}
        {phase === "illustrations" && (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border-border"
            onClick={() => {
              cancelRef.current = true;
              updateStatus.mutate({ id: projectId, status: "review" });
              onComplete();
            }}
          >
            <SkipForward className="w-4 h-4" /> Skip to Review
          </Button>
        )}
        {phase === "failed" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 border-border"
              onClick={handleRetry}
            >
              <RefreshCw className="w-4 h-4" /> Retry {failedCount} Failed
            </Button>
            <Button
              size="sm"
              className="rounded-xl gap-2 bg-primary text-primary-foreground"
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
            className="rounded-xl gap-2 bg-primary text-primary-foreground"
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
