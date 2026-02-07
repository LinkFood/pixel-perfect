import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, BookOpen, ImageIcon, RefreshCw, AlertTriangle, SkipForward, Check, X, Loader2, LayoutGrid, ChevronLeft, ChevronRight, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import PageEditor from "@/components/project/PageEditor";
import { toast } from "sonner";

type Phase = "loading" | "story" | "illustrations" | "done" | "failed";

type PageData = {
  id: string;
  page_number: number;
  page_type: string;
  text_content: string | null;
  illustration_prompt: string | null;
  is_approved: boolean;
};

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
  const cancelRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Live page data
  const [livePages, setLivePages] = useState<PageData[]>([]);
  const [liveIllustrations, setLiveIllustrations] = useState<Map<string, string>>(new Map());
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [skippedPageIds, setSkippedPageIds] = useState<Set<string>>(new Set());
  const [redoQueue, setRedoQueue] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "book">("grid");
  const [spreadIdx, setSpreadIdx] = useState(0);
  const [currentlyRenderingId, setCurrentlyRenderingId] = useState<string | null>(null);
  const [failedPageIds, setFailedPageIds] = useState<Set<string>>(new Set());

  // Fetch pages whenever they change
  const fetchPages = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("project_pages")
      .select("id, page_number, page_type, text_content, illustration_prompt, is_approved")
      .eq("project_id", id)
      .order("page_number");
    if (data) {
      setLivePages(data);
      setTotalPages(data.length);
    }
  }, [id]);

  // Fetch illustrations — only triggers re-render if data actually changed
  const fetchIllustrations = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("project_illustrations")
      .select("page_id, storage_path")
      .eq("project_id", id)
      .eq("is_selected", true);
    if (data) {
      setLiveIllustrations(prev => {
        // Build new map entries
        const entries = data.map(ill => {
          const existing = prev.get(ill.page_id);
          if (existing) return [ill.page_id, existing] as const;
          const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
          return [ill.page_id, urlData.publicUrl] as const;
        });
        // Skip re-render if nothing changed
        if (entries.length === prev.size && entries.every(([k, v]) => prev.get(k) === v)) {
          return prev;
        }
        return new Map(entries);
      });
      setIllustrationsGenerated(data.length);
    }
  }, [id]);

  // Listen for realtime page inserts — append delta instead of full refetch
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`pages-live-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_pages", filter: `project_id=eq.${id}` },
        (payload) => {
          setPagesGenerated(prev => prev + 1);
          const newPage = payload.new as PageData;
          if (newPage?.id) {
            setLivePages(prev => {
              if (prev.some(p => p.id === newPage.id)) return prev;
              const updated = [...prev, newPage].sort((a, b) => a.page_number - b.page_number);
              setTotalPages(updated.length);
              return updated;
            });
          } else {
            fetchPages();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchPages]);

  // Listen for realtime illustration inserts
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`illustrations-live-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_illustrations", filter: `project_id=eq.${id}` },
        () => fetchIllustrations()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchIllustrations]);

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
    const missingPages = pages.filter(p => !illustratedPageIds.has(p.id) && !skippedPageIds.has(p.id));

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
      if (cancelRef.current) break;
      if (skippedPageIds.has(page.id)) continue;

      const label = page.page_type === "cover" ? "Cover"
        : page.page_type === "dedication" ? "Dedication"
        : page.page_type === "back_cover" ? "Back Cover"
        : page.page_type === "closing" ? "Closing"
        : `Page ${page.page_number}`;
      setCurrentPageLabel(label);
      setCurrentlyRenderingId(page.id);

      try {
        const { error } = await supabase.functions.invoke("generate-illustration", {
          body: { pageId: page.id, projectId },
        });

        if (!error) {
          successes++;
          setFailedPageIds(prev => { const next = new Set(prev); next.delete(page.id); return next; });
        } else {
          console.error(`Illustration error for ${label}:`, error);
          setFailedPageIds(prev => { const next = new Set(prev); next.add(page.id); return next; });
          const errorBody = typeof error === "object" && error.message ? error.message : String(error);
          if (errorBody.includes("402") || errorBody.includes("Credits")) {
            toast.error(`${label}: Credits low, trying lighter model...`);
          } else if (errorBody.includes("429") || errorBody.includes("Rate")) {
            toast.error(`${label}: Rate limited, will retry remaining`);
          }
        }
      } catch (e) {
        console.error(`Illustration failed for ${label}:`, e);
        setFailedPageIds(prev => { const next = new Set(prev); next.add(page.id); return next; });
      }

      // 1.5 second delay between requests
      if (missingPages.indexOf(page) < missingPages.length - 1) {
        await sleep(1500);
      }
    }

    setCurrentPageLabel("");
    setCurrentlyRenderingId(null);

    // Process redo queue
    if (redoQueue.size > 0) {
      const redoPages = pages.filter(p => redoQueue.has(p.id));
      for (const page of redoPages) {
        try {
          await supabase.from("project_illustrations").delete().eq("page_id", page.id).eq("project_id", projectId);
          await supabase.functions.invoke("generate-illustration", {
            body: { pageId: page.id, projectId },
          });
        } catch (e) {
          console.error(`Redo failed for page ${page.id}:`, e);
        }
        await sleep(1500);
      }
      setRedoQueue(new Set());
    }

    const remaining = missingPages.length - successes;
    if (remaining > 0) {
      setFailedCount(remaining);
      setPhase("failed");
    } else {
      setPhase("done");
      updateStatus.mutate({ id: projectId, status: "review" });
    }
  }, [updateStatus, skippedPageIds, redoQueue]);

  // Main generation pipeline
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
        await fetchPages();
        await fetchIllustrations();
        await generateMissingIllustrations(id);
        return;
      }

      // Phase 1: Generate story
      setPhase("story");
      const { error: storyErr } = await supabase.functions.invoke("generate-story", { body: { projectId: id } });
      if (storyErr) {
        toast.error("Story generation failed — tap Retry to try again");
        console.error(storyErr);
        setPhase("failed");
        setFailedCount(0);
        return;
      }

      await fetchPages();

      // Phase 2: Generate illustrations
      await generateMissingIllustrations(id);
    };

    run();
  }, [id, generateMissingIllustrations, fetchPages, fetchIllustrations]);

  const handleRetry = async () => {
    if (!id) return;
    setIsRetrying(true);
    setFailedCount(0);
    cancelRef.current = false;

    // If no pages exist yet, retry story generation first
    if (livePages.length === 0) {
      setPhase("story");
      const { error: storyErr } = await supabase.functions.invoke("generate-story", { body: { projectId: id } });
      if (storyErr) {
        toast.error("Story generation failed again");
        console.error(storyErr);
        setPhase("failed");
        setIsRetrying(false);
        return;
      }
      await fetchPages();
    }

    await generateMissingIllustrations(id);
    setIsRetrying(false);
  };

  const handleStop = () => {
    cancelRef.current = true;
    toast.info("Stopping after current illustration finishes...");
  };

  const handleContinueToReview = () => {
    if (!id) return;
    updateStatus.mutate({ id, status: "review" });
    navigate(`/project/${id}/review`);
  };

  const handleApprove = async (pageId: string) => {
    await supabase.from("project_pages").update({ is_approved: true }).eq("id", pageId);
    setLivePages(prev => prev.map(p => p.id === pageId ? { ...p, is_approved: true } : p));
  };

  const handleReject = (pageId: string) => {
    setRedoQueue(prev => { const next = new Set(prev); next.add(pageId); return next; });
    toast.info("Queued for redo after first pass");
  };

  const handleSkip = (pageId: string) => {
    setSkippedPageIds(prev => { const next = new Set(prev); next.add(pageId); return next; });
  };

  const handleUpdateText = async (pageId: string, text: string) => {
    await supabase.from("project_pages").update({ text_content: text }).eq("id", pageId);
    setLivePages(prev => prev.map(p => p.id === pageId ? { ...p, text_content: text } : p));
  };

  const handleToggleApprove = async (pageId: string, approved: boolean) => {
    await supabase.from("project_pages").update({ is_approved: approved }).eq("id", pageId);
    setLivePages(prev => prev.map(p => p.id === pageId ? { ...p, is_approved: approved } : p));
  };

  const getProgress = () => {
    if (phase === "loading") return 0;
    if (phase === "story") return Math.min(pagesGenerated * 2, 45);
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
    if (phase === "failed" && livePages.length === 0) return "Story generation failed — tap Retry to try again";
    if (phase === "failed") return `${failedCount} illustration${failedCount !== 1 ? "s" : ""} failed to generate`;
    return "Your book is complete!";
  };

  const showThumbnails = livePages.length > 0 && (phase === "story" || phase === "illustrations" || phase === "done" || phase === "failed");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header section */}
          <div className="text-center mb-8">
            <motion.div
              animate={{ rotate: (phase === "done" || phase === "failed") ? 0 : 360 }}
              transition={{ duration: 2, repeat: (phase === "done" || phase === "failed") ? 0 : Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
            >
              {phase === "failed" ? (
                <AlertTriangle className="w-8 h-8 text-primary" />
              ) : phase === "illustrations" ? (
                <ImageIcon className="w-8 h-8 text-primary" />
              ) : (
                <Sparkles className="w-8 h-8 text-primary" />
              )}
            </motion.div>

            <h1 className="font-display text-2xl font-bold text-foreground mb-2">
              {phase === "done" ? "Your Book is Ready!" : phase === "failed" ? "Some Illustrations Failed" : "Creating Your Book"}
            </h1>

            <div className="max-w-md mx-auto space-y-2 mb-4">
              <Progress value={getProgress()} className="h-2" />
              <p className="font-body text-sm text-muted-foreground">{getStatusText()}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              {(phase === "story" || phase === "illustrations") && (
                <Button variant="destructive" size="sm" className="rounded-xl gap-2" onClick={handleStop}>
                  <StopCircle className="w-4 h-4" /> Stop
                </Button>
              )}
              {phase === "illustrations" && (
                <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleContinueToReview}>
                  <SkipForward className="w-4 h-4" /> Skip to Review
                </Button>
              )}
              {phase === "failed" && (
                <>
                  <Button variant="hero" size="sm" className="rounded-xl gap-2" onClick={handleRetry} disabled={isRetrying}>
                    <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
                    {isRetrying ? "Retrying..." : livePages.length === 0 ? "Retry Story" : `Retry ${failedCount} Failed`}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={handleContinueToReview}>
                    <BookOpen className="w-4 h-4" /> Continue to Review
                  </Button>
                </>
              )}
              {phase === "done" && (
                <Button variant="hero" size="sm" className="rounded-xl gap-2" onClick={handleContinueToReview}>
                  <BookOpen className="w-4 h-4" /> Review Your Book
                </Button>
              )}
            </div>
          </div>

          {/* View toggle */}
          {showThumbnails && (
            <div className="flex justify-center gap-1 mb-6">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </Button>
              <Button
                variant={viewMode === "book" ? "default" : "outline"}
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => setViewMode("book")}
              >
                <BookOpen className="w-3.5 h-3.5" /> Book
              </Button>
            </div>
          )}

          {/* Book spread view */}
          {showThumbnails && viewMode === "book" && (() => {
            // Build spreads from live pages
            const spreads: [PageData | null, PageData | null][] = [];
            if (livePages.length > 0) {
              spreads.push([null, livePages[0]]); // blank + cover
              for (let i = 1; i < livePages.length; i += 2) {
                spreads.push([livePages[i], livePages[i + 1] || null]);
              }
            }
            const currentSpread = spreads[spreadIdx] || spreads[0];
            if (!currentSpread) return null;

            const renderSpreadPage = (page: PageData | null) => {
              if (!page) {
                return (
                  <div className="flex-1 aspect-square bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30" />
                );
              }
              const illUrl = liveIllustrations.get(page.id);
              return (
                <div className="flex-1 bg-card overflow-hidden">
                  <div className="aspect-square bg-secondary/50 relative">
                    {illUrl ? (
                      <img src={illUrl} alt={`Page ${page.page_number}`} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {phase === "illustrations" ? (
                          <Loader2 className="w-8 h-8 text-muted-foreground/30 animate-spin" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-muted-foreground/20" />
                        )}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-body text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5">
                        {page.page_type === "cover" ? "Cover"
                          : page.page_type === "dedication" ? "Dedication"
                          : page.page_type === "closing" ? "Closing"
                          : page.page_type === "back_cover" ? "Back Cover"
                          : `Page ${page.page_number}`}
                      </span>
                    </div>
                    {/* Text overlay */}
                    {page.text_content && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-10 pb-4 px-4">
                        <p className="font-display text-sm leading-relaxed text-white text-center line-clamp-3 drop-shadow-md">
                          {page.text_content}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
              >
                {/* Spread */}
                <div className="flex rounded-2xl overflow-hidden border border-border shadow-lg">
                  <div className="flex-1 border-r border-border/30">
                    {renderSpreadPage(currentSpread[0])}
                  </div>
                  <div className="w-1 bg-gradient-to-r from-black/10 via-black/5 to-black/10 flex-shrink-0" />
                  <div className="flex-1">
                    {renderSpreadPage(currentSpread[1])}
                  </div>
                </div>
                {/* Spread navigation */}
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    disabled={spreadIdx === 0}
                    onClick={() => setSpreadIdx(s => s - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <span className="font-body text-sm text-muted-foreground">
                    {spreadIdx + 1} / {spreads.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1"
                    disabled={spreadIdx >= spreads.length - 1}
                    onClick={() => setSpreadIdx(s => s + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            );
          })()}

          {/* Status legend */}
          {showThumbnails && viewMode === "grid" && (
            <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-body text-muted-foreground">Rendering</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
                <span className="text-xs font-body text-muted-foreground">Queued</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs font-body text-muted-foreground">Done</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-xs font-body text-muted-foreground">Failed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-xs font-body text-muted-foreground">Redo queued</span>
              </div>
            </div>
          )}

          {/* Live page thumbnails grid */}
          {showThumbnails && viewMode === "grid" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3"
            >
              {livePages.map(page => {
                const illUrl = liveIllustrations.get(page.id);
                const isSkipped = skippedPageIds.has(page.id);
                const isRedoQueued = redoQueue.has(page.id);
                const isRendering = currentlyRenderingId === page.id;
                const isFailed = failedPageIds.has(page.id) && !illUrl;
                const isDone = !!illUrl && !isRedoQueued;
                const isQueued = !illUrl && !isRendering && !isFailed && !isSkipped && phase === "illustrations";

                const label = page.page_type === "cover" ? "Cover"
                  : page.page_type === "dedication" ? "Ded."
                  : page.page_type === "back_cover" ? "Back"
                  : page.page_type === "closing" ? "Close"
                  : `P${page.page_number}`;

                // Status-based border color
                const borderClass = isRendering ? "border-blue-500 shadow-blue-500/20 shadow-md"
                  : isFailed ? "border-red-400/70"
                  : page.is_approved ? "border-green-400/60"
                  : isRedoQueued ? "border-amber-400/60"
                  : isDone ? "border-green-300/40"
                  : "border-border";

                return (
                  <motion.div
                    key={page.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "relative rounded-xl border-2 overflow-hidden bg-card cursor-pointer transition-all group",
                      borderClass,
                      isSkipped ? "opacity-40" : "",
                      selectedPageId === page.id ? "ring-2 ring-primary shadow-lg" : ""
                    )}
                    onClick={() => setSelectedPageId(selectedPageId === page.id ? null : page.id)}
                  >
                    {/* Thumbnail illustration */}
                    <div className="aspect-square bg-secondary/50 relative">
                      {illUrl ? (
                        <img src={illUrl} alt={label} className="w-full h-full object-cover" loading="lazy" />
                      ) : isRendering ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-blue-50/50 dark:bg-blue-950/20">
                          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                          <span className="text-[9px] font-body text-blue-600 dark:text-blue-400 font-medium">Rendering...</span>
                        </div>
                      ) : isFailed ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50/50 dark:bg-red-950/20">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                          <span className="text-[9px] font-body text-red-500 font-medium">Failed</span>
                        </div>
                      ) : isQueued ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          <span className="text-[9px] font-body text-muted-foreground/50">Queued</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Status badge - top right */}
                      {isDone && page.is_approved && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isDone && !page.is_approved && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-400/80 flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {isRedoQueued && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-sm">
                          <RefreshCw className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {/* Text overlay on thumbnail */}
                      {illUrl && page.text_content && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 pt-4">
                          <p className="text-[8px] font-display text-white line-clamp-2 leading-tight text-center drop-shadow-sm">
                            {page.text_content}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <div className="p-1.5">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] font-body font-medium text-muted-foreground">{label}</p>
                        {isRendering && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        {isFailed && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      </div>
                    </div>

                    {/* Hover actions */}
                    {illUrl && !isSkipped && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 pointer-events-none">
                        {!page.is_approved && (
                          <button
                            className="w-7 h-7 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors pointer-events-auto"
                            onClick={(e) => { e.stopPropagation(); handleApprove(page.id); }}
                            title="Approve"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>
                        )}
                        <button
                          className="w-7 h-7 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors pointer-events-auto"
                          onClick={(e) => { e.stopPropagation(); handleReject(page.id); }}
                          title="Redo"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-white" />
                        </button>
                      </div>
                    )}
                    {!illUrl && !isSkipped && !isRendering && (phase === "illustrations" || isFailed) && (
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <button
                          className="w-7 h-7 rounded-full bg-gray-500 hover:bg-gray-600 flex items-center justify-center transition-colors pointer-events-auto"
                          onClick={(e) => { e.stopPropagation(); handleSkip(page.id); }}
                          title="Skip"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Selected page detail (grid mode only) */}
          {viewMode === "grid" && selectedPageId && (() => {
            const page = livePages.find(p => p.id === selectedPageId);
            if (!page) return null;
            const illUrl = liveIllustrations.get(page.id);
            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 max-w-2xl mx-auto bg-card rounded-2xl border border-border overflow-hidden"
              >
                {/* Close button */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="font-display text-sm font-medium text-muted-foreground">
                    {page.page_type === "cover" ? "Cover"
                      : page.page_type === "dedication" ? "Dedication"
                      : page.page_type === "closing" ? "Closing"
                      : page.page_type === "back_cover" ? "Back Cover"
                      : `Page ${page.page_number}`}
                  </span>
                  <button
                    className="w-7 h-7 rounded-full hover:bg-secondary flex items-center justify-center transition-colors"
                    onClick={() => setSelectedPageId(null)}
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                {/* Content: illustration + editor side by side on md+ */}
                <div className="flex flex-col md:flex-row">
                  {illUrl && (
                    <div className="md:w-1/2 flex-shrink-0">
                      <img src={illUrl} alt={`Page ${page.page_number}`} className="w-full aspect-square object-cover" loading="lazy" />
                    </div>
                  )}
                  <div className={cn("p-4 flex-1", illUrl ? "" : "w-full")}>
                    <PageEditor
                      pageId={page.id}
                      textContent={page.text_content}
                      illustrationPrompt={page.illustration_prompt}
                      isApproved={page.is_approved}
                      onUpdateText={(text) => handleUpdateText(page.id, text)}
                      onToggleApprove={(approved) => handleToggleApprove(page.id, approved)}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectGenerating;
