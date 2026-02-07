import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, ImageIcon, RefreshCw, AlertTriangle, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import { toast } from "sonner";

type Phase = "loading" | "story" | "illustrations" | "done" | "failed";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ProjectGenerating = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const updateStatus = useUpdateProjectStatus();

  const [phase, setPhase] = useState<Phase>("loading");
  const [pagesGenerated, setPagesGenerated] = useState(0);
  const [illustrationsGenerated, setIllustrationsGenerated] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [currentPageLabel, setCurrentPageLabel] = useState("");
  const startedRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Listen for realtime page inserts (phase 1)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_pages", filter: `project_id=eq.${id}` },
        () => setPagesGenerated(prev => prev + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Listen for realtime illustration inserts (phase 2)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`illustrations-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_illustrations", filter: `project_id=eq.${id}` },
        () => setIllustrationsGenerated(prev => prev + 1)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const generateMissingIllustrations = useCallback(async (projectId: string) => {
    // Get all pages
    const { data: pages } = await supabase
      .from("project_pages")
      .select("id, page_number, page_type")
      .eq("project_id", projectId)
      .order("page_number");

    if (!pages || pages.length === 0) {
      toast.error("No pages found");
      return;
    }

    // Get existing illustrations
    const { data: existingIllustrations } = await supabase
      .from("project_illustrations")
      .select("page_id")
      .eq("project_id", projectId);

    const illustratedPageIds = new Set((existingIllustrations || []).map(i => i.page_id));
    const missingPages = pages.filter(p => !illustratedPageIds.has(p.id));

    setTotalPages(pages.length);
    setIllustrationsGenerated(pages.length - missingPages.length);

    if (missingPages.length === 0) {
      setPhase("done");
      updateStatus.mutate({ id: projectId, status: "review" });
      return;
    }

    setPhase("illustrations");

    let successes = 0;
    for (const page of missingPages) {
      // Show which page is being illustrated
      const label = page.page_type === "cover" ? "Cover"
        : page.page_type === "dedication" ? "Dedication"
        : page.page_type === "back_cover" ? "Back Cover"
        : page.page_type === "closing" ? "Closing"
        : `Page ${page.page_number}`;
      setCurrentPageLabel(label);

      try {
        const { data, error } = await supabase.functions.invoke("generate-illustration", {
          body: { pageId: page.id, projectId },
        });

        if (!error) {
          successes++;
        } else {
          console.error(`Illustration error for ${label}:`, error);
          // Show specific error messages
          const errorBody = typeof error === "object" && error.message ? error.message : String(error);
          if (errorBody.includes("402") || errorBody.includes("Credits")) {
            toast.error(`${label}: Credits low, trying lighter model...`);
          } else if (errorBody.includes("429") || errorBody.includes("Rate")) {
            toast.error(`${label}: Rate limited, will retry remaining`);
          }
        }
      } catch (e) {
        console.error(`Illustration failed for ${label}:`, e);
      }

      // 1.5 second delay between requests to prevent 429 cascades
      if (missingPages.indexOf(page) < missingPages.length - 1) {
        await sleep(1500);
      }
    }

    setCurrentPageLabel("");
    const remaining = missingPages.length - successes;
    if (remaining > 0) {
      setFailedCount(remaining);
      setPhase("failed");
    } else {
      setPhase("done");
      updateStatus.mutate({ id: projectId, status: "review" });
    }
  }, [updateStatus]);

  // Main generation pipeline with smart resume
  useEffect(() => {
    if (!id || startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      // Smart resume: check existing state
      const { data: existingPages } = await supabase
        .from("project_pages")
        .select("id")
        .eq("project_id", id);

      if (existingPages && existingPages.length > 0) {
        // Pages already exist — skip story, go straight to illustrations
        await generateMissingIllustrations(id);
        return;
      }

      // Phase 1: Generate story
      setPhase("story");
      const { error: storyErr } = await supabase.functions.invoke("generate-story", { body: { projectId: id } });
      if (storyErr) {
        toast.error("Story generation failed");
        console.error(storyErr);
        return;
      }

      // Phase 2: Generate illustrations
      await generateMissingIllustrations(id);
    };

    run();
  }, [id, generateMissingIllustrations]);

  const handleRetry = async () => {
    if (!id) return;
    setIsRetrying(true);
    setFailedCount(0);
    await generateMissingIllustrations(id);
    setIsRetrying(false);
  };

  const handleSkip = () => {
    if (!id) return;
    updateStatus.mutate({ id, status: "review" });
    navigate(`/project/${id}/review`);
  };

  const getProgress = () => {
    if (phase === "loading") return 0;
    if (phase === "story") return Math.min(pagesGenerated * 2, 45); // grows gradually, caps at 45%
    if (phase === "illustrations" || phase === "failed") {
      return totalPages > 0 ? 50 + (illustrationsGenerated / totalPages) * 50 : 50;
    }
    return 100;
  };

  const getStatusText = () => {
    if (phase === "loading") return "Checking progress...";
    if (phase === "story") return `Writing story... ${pagesGenerated} page${pagesGenerated !== 1 ? "s" : ""} so far`;
    if (phase === "illustrations") {
      const base = `Creating illustrations... ${illustrationsGenerated} of ${totalPages}`;
      return currentPageLabel ? `${base} — Drawing ${currentPageLabel}` : base;
    }
    if (phase === "failed") return `${failedCount} illustration${failedCount !== 1 ? "s" : ""} failed to generate`;
    return "Your book is complete!";
  };

  const PhaseIcon = phase === "failed" ? AlertTriangle : phase === "illustrations" ? ImageIcon : Sparkles;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <motion.div
            animate={{ rotate: (phase === "done" || phase === "failed") ? 0 : 360 }}
            transition={{ duration: 2, repeat: (phase === "done" || phase === "failed") ? 0 : Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8"
          >
            <PhaseIcon className="w-10 h-10 text-primary" />
          </motion.div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-3">
            {phase === "done" ? "Your Book is Ready!" : phase === "failed" ? "Some Illustrations Failed" : "Creating Your Book"}
          </h1>
          <p className="font-body text-muted-foreground mb-10">
            {phase === "done"
              ? `${project?.pet_name}'s story has been written and illustrated`
              : phase === "failed"
              ? "Don't worry — you can retry the failed illustrations or continue to review"
              : `Crafting ${project?.pet_name || "your pet"}'s story...`}
          </p>

          <div className="space-y-3 mb-10">
            <Progress value={getProgress()} className="h-3" />
            <p className="font-body text-sm text-muted-foreground">{getStatusText()}</p>
          </div>

          {/* Skip button during illustration generation */}
          {phase === "illustrations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }} className="mb-6">
              <Button variant="outline" size="lg" className="rounded-xl gap-2" onClick={handleSkip}>
                <SkipForward className="w-5 h-5" /> Continue to Review (skip remaining)
              </Button>
            </motion.div>
          )}

          {phase === "failed" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3 items-center">
              <Button variant="hero" size="lg" className="rounded-xl gap-2" onClick={handleRetry} disabled={isRetrying}>
                <RefreshCw className={`w-5 h-5 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : `Retry ${failedCount} Failed`}
              </Button>
              <Button variant="outline" size="lg" className="rounded-xl gap-2" onClick={() => navigate(`/project/${id}/review`)}>
                <BookOpen className="w-5 h-5" /> Continue to Review
              </Button>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button variant="hero" size="lg" className="rounded-xl gap-2" onClick={() => navigate(`/project/${id}/review`)}>
                <BookOpen className="w-5 h-5" /> Review Your Book
              </Button>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectGenerating;
