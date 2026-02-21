import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, SkipForward, StopCircle, Check, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "./ChatMessage";
import BuildLog from "./BuildLog";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateProjectStatus } from "@/hooks/useProject";
import { toast } from "sonner";
import { useChainLogSafe } from "@/hooks/useChainLog";
import { isDevMode } from "@/lib/devMode";

type Phase = "loading" | "story" | "illustrations" | "done" | "failed";

interface GenerationViewProps {
  projectId: string;
  petName: string;
  onComplete: () => void;
  hideRabbit?: boolean;
  onNewIllustration?: (pageNum: number, url: string) => void;
  interviewHighlights?: string[];
  mood?: string | null;
  tokenCost?: number;
  creditBalance?: number | null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Mood-aware rabbit state cycles during illustration phase
function getIllustrationCycleStates(mood: string | null | undefined): RabbitState[] {
  const normalized = normalizeMood(mood);
  switch (normalized) {
    case "memorial":
      return ["painting", "sympathetic", "painting", "listening", "sympathetic", "painting"];
    case "funny":
      return ["painting", "excited", "painting", "excited", "painting", "excited"];
    case "heartfelt":
      return ["painting", "listening", "painting", "thinking", "painting", "listening"];
    case "adventure":
      return ["painting", "excited", "painting", "excited", "painting", "thinking"];
    default: // custom or unknown
      return ["painting", "thinking", "excited", "painting", "listening", "painting"];
  }
}

// Normalize mood string — custom moods start with "custom:" prefix
function normalizeMood(mood: string | null | undefined): string {
  if (!mood) return "default";
  if (mood.startsWith("custom:")) return "custom";
  return mood;
}

// Mood-aware illustration reaction messages (when a new batch completes)
function getIllustrationReactions(mood: string | null | undefined): string[] {
  const normalized = normalizeMood(mood);
  switch (normalized) {
    case "memorial":
      return [
        "Painting this memory with care...",
        "I want to honor every detail...",
        "This one means a lot...",
        "Taking my time with this one...",
        "Holding this memory gently...",
      ];
    case "funny":
      return [
        "Oh wait till you see this one...",
        "I may have gotten carried away with this page...",
        "This is going to crack you up...",
        "I'm giggling while I paint this...",
        "This one has serious comedic timing...",
      ];
    case "heartfelt":
      return [
        "Putting all the love into this one...",
        "I can feel how much they mean to you...",
        "This page made me tear up a little...",
        "Every brushstroke feels important here...",
        "This one is full of warmth...",
      ];
    case "adventure":
      return [
        "Buckle up, this page is wild...",
        "The action scene is coming together...",
        "This one has serious main-character energy...",
        "Epic moment incoming...",
        "I'm painting this one with maximum drama...",
      ];
    default: // custom or unknown
      return [
        "Look at this one!",
        "This page came out great!",
        "Another one done!",
        "I'm really happy with this one...",
        "Coming together nicely...",
      ];
  }
}

// Mood-aware story phase messages
function getStoryMessages(mood: string | null | undefined, petName: string, interviewHighlights: string[]): string[] {
  const normalized = normalizeMood(mood);

  if (interviewHighlights.length > 0) {
    const highlightMsgs = interviewHighlights.slice(0, 4).map(h => `Writing about ${h}...`);
    switch (normalized) {
      case "memorial":
        return [
          `Reading everything you shared about ${petName}...`,
          ...highlightMsgs,
          `Choosing words that honor their memory...`,
          `Writing with the care this story deserves...`,
          `This is going to be something special...`,
        ];
      case "funny":
        return [
          `Reading everything you shared about ${petName}...`,
          ...highlightMsgs,
          `Finding the funniest angles...`,
          `Writing the jokes in... this is good...`,
          `This story is going to be a riot...`,
        ];
      case "heartfelt":
        return [
          `Reading everything you shared about ${petName}...`,
          ...highlightMsgs,
          `Weaving in all that love...`,
          `Choosing the warmest words...`,
          `This story is full of heart...`,
        ];
      case "adventure":
        return [
          `Reading everything you shared about ${petName}...`,
          ...highlightMsgs,
          `Building up the adventure arc...`,
          `Adding some epic twists...`,
          `This story has serious momentum...`,
        ];
      default:
        return [
          `Reading everything you shared about ${petName}...`,
          ...highlightMsgs,
          `Weaving your memories into prose...`,
          `Choosing the perfect words...`,
          `This is going to be a good one...`,
        ];
    }
  }

  switch (normalized) {
    case "memorial":
      return [
        `Reading everything you shared about ${petName}...`,
        `Getting to know ${petName}...`,
        `Honoring every detail you told me...`,
        `Choosing words that feel right...`,
        `Writing this with the gentleness it deserves...`,
        `Almost there... taking my time with this...`,
        `This story will be something to treasure...`,
      ];
    case "funny":
      return [
        `Reading everything you shared about ${petName}...`,
        `Getting to know ${petName}...`,
        `Finding the funniest moments...`,
        `Writing the comedy gold in...`,
        `This story is cracking me up already...`,
        `Polishing the punchlines...`,
        `Oh this is going to be good...`,
      ];
    case "heartfelt":
      return [
        `Reading everything you shared about ${petName}...`,
        `Getting to know ${petName}...`,
        `Weaving in all the love...`,
        `Choosing the warmest words I know...`,
        `Writing page by page with care...`,
        `This story is full of heart...`,
        `Almost done... it's beautiful...`,
      ];
    case "adventure":
      return [
        `Reading everything you shared about ${petName}...`,
        `Getting to know ${petName}...`,
        `Building the adventure arc...`,
        `Adding twists and epic moments...`,
        `Writing the action sequences...`,
        `This story has serious momentum...`,
        `Hang on, the climax is coming together...`,
      ];
    default:
      return [
        `Reading everything you shared about ${petName}...`,
        `Getting to know ${petName}...`,
        `Crafting the narrative arc...`,
        `Weaving your memories into prose...`,
        `Writing the story page by page...`,
        `Choosing the perfect words...`,
        `Polishing the story...`,
      ];
  }
}

// Mood-aware first illustration message
function getIllustrationIntroMessage(mood: string | null | undefined, interviewHighlights: string[]): string {
  const normalized = normalizeMood(mood);
  if (interviewHighlights.length > 0) {
    switch (normalized) {
      case "memorial":
        return `Now I'm going to illustrate the story. I'll paint the ${interviewHighlights[0]} scene with extra care...`;
      case "funny":
        return `Now I'm going to illustrate the story. The ${interviewHighlights[0]} scene is going to be hilarious...`;
      case "heartfelt":
        return `Now I'm going to illustrate the story. Starting with the ${interviewHighlights[0]} scene... this one's special.`;
      case "adventure":
        return `Now I'm going to illustrate the story. The ${interviewHighlights[0]} scene is going to be epic...`;
      default:
        return `Now I'm going to illustrate the story. I can already picture the ${interviewHighlights[0]} scene...`;
    }
  }
  switch (normalized) {
    case "memorial":
      return `Now I'm going to illustrate the story. I'll paint each memory with care.`;
    case "funny":
      return `Now I'm going to illustrate the story. This is going to be a blast!`;
    case "heartfelt":
      return `Now I'm going to illustrate the story. Every page will glow with warmth.`;
    case "adventure":
      return `Now I'm going to illustrate the story. Time to bring the action to life!`;
    default:
      return `Now I'm going to illustrate the story. This is my favorite part!`;
  }
}

/** Component that loads an image hidden, then reveals blur → sharp */
const IllustrationReveal = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 shimmer rounded-2xl bg-primary/5" />
      )}
      <motion.img
        src={src}
        alt={alt}
        className={`w-full h-auto object-cover ${loaded ? "reveal-blur" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
      {/* Warm glow ring on reveal */}
      {loaded && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ boxShadow: "inset 0 0 30px hsl(var(--primary) / 0.3)" }}
          animate={{ boxShadow: "inset 0 0 0px hsl(var(--primary) / 0)" }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      )}
    </div>
  );
};

const GenerationView = ({ projectId, petName, onComplete, hideRabbit, onNewIllustration, interviewHighlights = [], mood, tokenCost = 0, creditBalance = null }: GenerationViewProps) => {
  const updateStatus = useUpdateProjectStatus();
  const { addEvent, updateEvent } = useChainLogSafe();
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
  const moodCycleStates = useMemo(() => getIllustrationCycleStates(mood), [mood]);
  useEffect(() => {
    if (phase !== "illustrations") return;
    let idx = 0;
    const timer = setInterval(() => {
      if (spotlightActiveRef.current) return;
      idx = (idx + 1) % moodCycleStates.length;
      setRabbitState(moodCycleStates[idx]);
    }, 8000);
    return () => clearInterval(timer);
  }, [phase, moodCycleStates]);

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

  // Story phase rotating messages — mood-aware, with interview highlights when available
  const storyMessages = getStoryMessages(mood, petName, interviewHighlights);

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
            const newUrl = urls[urls.length - 1];
            setLatestIllustration(newUrl);
            spotlightActiveRef.current = true;
            setRabbitState("presenting");

            // Notify parent for inline chat preview
            if (onNewIllustration) {
              onNewIllustration(data.length, newUrl);
            }

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
  }, [projectId, onNewIllustration]);

  // Fire variant illustrations in background (server completes regardless of unmount)
  const fireVariantsInBackground = useCallback((variantPages: { id: string }[]) => {
    variantPages.forEach((page, i) => {
      setTimeout(() => {
        if (isDevMode()) {
          addEvent({
            phase: "illustration", step: `generate-illustration-variant page ${i + 1}`,
            status: "running", model: "Gemini 3 Pro",
            input: JSON.stringify({ pageId: page.id, projectId, variant: true }).slice(0, 500),
          });
        }
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
    addMessage(getIllustrationIntroMessage(mood, interviewHighlights));

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

      // Fire batch concurrently with chain logging
      const batchEventIds: string[] = [];
      const batchStartTime = Date.now();
      if (isDevMode()) {
        batchItems.forEach(page => {
          batchEventIds.push(addEvent({
            phase: "illustration",
            step: `generate-illustration page ${page.page_number}`,
            status: "running",
            input: JSON.stringify({ pageId: page.id, projectId }).slice(0, 500),
            model: "Gemini 3 Pro",
            metadata: { pageNumber: page.page_number, pageType: page.page_type },
          }));
        });
      }

      const results = await Promise.allSettled(
        batchItems.map(page =>
          supabase.functions.invoke("generate-illustration", {
            body: { pageId: page.id, projectId, variant: false },
          })
        )
      );

      let batchSuccesses = 0;
      for (let ri = 0; ri < results.length; ri++) {
        const result = results[ri];
        if (result.status === "fulfilled" && !result.value.error) {
          batchSuccesses++;
          successes++;
          if (isDevMode() && batchEventIds[ri]) {
            updateEvent(batchEventIds[ri], {
              status: "success",
              output: JSON.stringify(result.value.data).slice(0, 500),
              durationMs: Date.now() - batchStartTime,
            });
          }
        } else {
          failures++;
          if (isDevMode() && batchEventIds[ri]) {
            const errMsg = result.status === "rejected" ? result.reason?.message : result.value?.error?.message || "Unknown error";
            updateEvent(batchEventIds[ri], { status: "error", errorMessage: errMsg, durationMs: Date.now() - batchStartTime });
          }
        }
      }

      if (batchSuccesses > 0) {
        setRabbitState("presenting");
        const reactions = getIllustrationReactions(mood);
        const reactionMsg = reactions[Math.floor(Math.random() * reactions.length)];
        addMessage(batchSuccesses === 1 ? reactionMsg : `${batchSuccesses} more pages done!`);
        setTimeout(() => setRabbitState("painting"), 2000);
      }

      // Brief delay between batches
      if (batch + CONCURRENCY < initialWork.length) {
        await sleep(250);
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

      let storyEventId = "";
      const storyStart = Date.now();
      if (isDevMode()) {
        storyEventId = addEvent({
          phase: "story", step: "generate-story", status: "running",
          input: JSON.stringify({ projectId }).slice(0, 500), model: "GPT-5.2",
        });
      }

      const { data: storyData, error: storyErr } = await supabase.functions.invoke("generate-story", {
        body: { projectId },
      });

      if (storyErr) {
        if (isDevMode() && storyEventId) updateEvent(storyEventId, { status: "error", errorMessage: storyErr.message, durationMs: Date.now() - storyStart });
        setPhase("failed");
        setRabbitState("sympathetic");
        addMessage("Something went wrong with the story. Let me try again if you'd like.");
        return;
      }

      if (isDevMode() && storyEventId) {
        updateEvent(storyEventId, {
          status: "success",
          output: JSON.stringify(storyData).slice(0, 500),
          durationMs: Date.now() - storyStart,
          tokenCount: storyData?.usage?.total_tokens,
        });
      }

      addMessage(`The story is written! Now let me illustrate it...`);

      // Phase 2: Illustrations
      await generateIllustrations();
    };

    run();
  }, [projectId, generateIllustrations, addMessage, petName]);

  const isRetryingRef = useRef(false);
  const handleRetry = () => {
    if (isRetryingRef.current) return;
    isRetryingRef.current = true;
    cancelRef.current = false;
    setFailedCount(0);
    setElapsedSeconds(0);
    prevIllCountRef.current = 0;
    setRabbitMessages(prev => [...prev, "Let me try those again..."]);
    generateIllustrations().finally(() => { isRetryingRef.current = false; });
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
      {!hideRabbit && (
        <div className="flex justify-center py-4">
          <RabbitCharacter state={rabbitState} size={140} />
        </div>
      )}

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
                  <motion.div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-body font-semibold shrink-0 ${
                      isComplete ? "bg-green-500 text-white"
                        : isActive ? "bg-primary text-white"
                        : "bg-border text-muted-foreground"
                    }`}
                    animate={isActive ? {
                      boxShadow: [
                        "0 0 0 0 hsl(var(--primary) / 0.3)",
                        "0 0 12px 4px hsl(var(--primary) / 0.2)",
                        "0 0 0 0 hsl(var(--primary) / 0.3)",
                      ],
                    } : {}}
                    transition={isActive ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                  >
                    {isComplete ? (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : s.step}
                  </motion.div>
                  <span
                    className={`font-body text-xs whitespace-nowrap ${
                      isActive ? "text-primary font-medium"
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

        {/* Progress bar — indeterminate shimmer during story, real progress during illustrations */}
        {(phase === "story" || phase === "loading") && (
          <div className="mt-2 max-w-xs mx-auto">
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary/60"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: "40%" }}
              />
            </div>
          </div>
        )}
        {phase === "illustrations" && totalPages > 0 && (
          <div className="mt-2 max-w-xs mx-auto">
            <Progress
              value={progressPercent}
              className="h-2 rounded-full bg-secondary"
            />
          </div>
        )}

        {/* Cost bar — always visible during generation */}
        {(phase === "story" || phase === "illustrations" || phase === "loading") && (
          <div className="mt-3 mx-auto max-w-sm bg-muted/50 rounded-lg px-4 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-body text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{formatElapsed(elapsedSeconds)}</span>
              </span>
            </div>
            {tokenCost > 0 && (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-body text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{tokenCost}</span> token{tokenCost !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {creditBalance !== null && (
              <span className="font-body text-xs text-muted-foreground">
                <span className="text-foreground font-medium">{Math.max(0, (creditBalance ?? 0) - tokenCost)}</span> left
              </span>
            )}
          </div>
        )}
      </div>

      {/* Narrated messages + illustration reveals */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
        {rabbitMessages.map((msg, i) => (
          <ChatMessage key={`${i}-${msg.slice(0, 20)}`} role="rabbit" content={msg} />
        ))}

        {/* Latest illustration — persistent hero with blur-to-sharp reveal */}
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
                className="rounded-2xl overflow-hidden shadow-float border-2 border-primary/40 glow-primary w-full"
              >
                <IllustrationReveal
                  src={latestIllustration}
                  alt="Latest illustration"
                />
                <div className="px-3 py-2 flex items-center justify-between glass-warm">
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

        {/* Previous illustrations — gallery row with slight rotation */}
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
                    initial={{ opacity: 0, scale: 0.8, y: 10, rotate: (i % 2 === 0 ? 2 : -2) }}
                    animate={{ opacity: 1, scale: 1, y: 0, rotate: (i % 3 - 1) * 1.5 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.1, rotate: 0, zIndex: 10 }}
                    className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border shadow-chat cursor-pointer"
                  >
                    <img src={url} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Pulse indicator */}
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
          </div>
        )}

        {/* Build Log — collapsible "Under the Hood" */}
        <BuildLog projectId={projectId} />
      </div>

      {/* Action buttons */}
      <div className="px-4 md:px-0 pb-4 flex items-center justify-center gap-3">
        {phase === "illustrations" && (
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
