import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, SkipForward, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const GenerationView = ({ projectId, petName, onComplete }: GenerationViewProps) => {
  const updateStatus = useUpdateProjectStatus();
  const [phase, setPhase] = useState<Phase>("loading");
  const [rabbitState, setRabbitState] = useState<RabbitState>("thinking");
  const [rabbitMessages, setRabbitMessages] = useState<string[]>([]);
  const [completedIllustrations, setCompletedIllustrations] = useState<string[]>([]); // URLs
  const [totalPages, setTotalPages] = useState(0);
  const [illustrationsGenerated, setIllustrationsGenerated] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const startedRef = useRef(false);
  const cancelRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((msg: string) => {
    setRabbitMessages(prev => [...prev, msg]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

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

  // Realtime: listen for new illustrations
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
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

    const illustratedIds = new Set((existing || []).map(i => i.page_id));

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

    for (let i = 0; i < work.length; i++) {
      if (cancelRef.current) break;

      const { page, isVariant } = work[i];
      const label = page.page_type === "cover" ? "the cover"
        : page.page_type === "dedication" ? "the dedication"
        : `page ${page.page_number}`;

      if (!isVariant) {
        addMessage(`Painting ${label}...`);
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

  return (
    <div className="flex flex-col h-full">
      {/* Rabbit at top */}
      <div className="flex justify-center py-4">
        <RabbitCharacter state={rabbitState} size={140} />
      </div>

      {/* Narrated messages + illustration reveals */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
        {rabbitMessages.map((msg, i) => (
          <ChatMessage key={`${i}-${msg.slice(0, 20)}`} role="rabbit" content={msg} />
        ))}

        {/* Completed illustrations shelf */}
        {completedIllustrations.length > 0 && (
          <div className="py-3">
            <p className="font-body text-xs mb-2" style={{ color: "#9B8E7F" }}>
              {illustrationsGenerated} of {totalPages} pages illustrated
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <AnimatePresence>
                {completedIllustrations.map((url, i) => (
                  <motion.div
                    key={url}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
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

        {/* Loading indicator */}
        {(phase === "story" || phase === "illustrations") && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#C4956A" }} />
            <span className="font-body text-xs" style={{ color: "#9B8E7F" }}>
              {phase === "story" ? "Writing story..." : "Painting..."}
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
