import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useChainLogSafe } from "@/hooks/useChainLog";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle, Eye, Download, ImageIcon, Loader2, ScanFace, Share2, Copy, Check, ArrowLeft, MoreHorizontal, Palette, Sparkles, ChevronDown } from "lucide-react";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import ConfettiBurst from "@/components/ConfettiBurst";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import BookPageViewer from "@/components/project/BookPageViewer";
import PageEditor from "@/components/project/PageEditor";
import BookPreview from "@/components/project/BookPreview";
import { useProject } from "@/hooks/useProject";
import { usePhotos, getPhotoUrl } from "@/hooks/usePhotos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { isDevMode } from "@/lib/devMode";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Page = {
  id: string;
  page_number: number;
  page_type: string;
  text_content: string | null;
  illustration_prompt: string | null;
  scene_description: string | null;
  is_approved: boolean;
};

type Illustration = {
  id: string;
  page_id: string;
  storage_path: string;
};

type GalleryGridPhoto = {
  photoUrl: string;
  caption: string | null;
};

type VirtualPage = {
  type: "story";
  page: Page;
} | {
  type: "photo_gallery_title";
  petName: string;
} | {
  type: "photo_gallery_grid";
  photos: GalleryGridPhoto[];
};

interface BookReviewProps {
  projectId: string;
  onBack: () => void;
}

const WRAP_OPTIONS = [
  { id: "classic", label: "Classic", color: "bg-orange-100 border-orange-300" },
  { id: "gold", label: "Gold", color: "bg-amber-200 border-amber-400" },
  { id: "midnight", label: "Midnight", color: "bg-indigo-900 border-indigo-600" },
  { id: "garden", label: "Garden", color: "bg-emerald-200 border-emerald-400" },
];

const BookReview = ({ projectId, onBack }: BookReviewProps) => {
  const id = projectId;
  const { data: project } = useProject(id);
  const { addEvent, updateEvent } = useChainLogSafe();
  const { data: photos = [] } = usePhotos(id);
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isRebuildingProfile, setIsRebuildingProfile] = useState(false);
  const [brokenImagePageIds, setBrokenImagePageIds] = useState<Set<string>>(new Set());
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectedWrap, setSelectedWrap] = useState("classic");
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [showDoneOverlay, setShowDoneOverlay] = useState(false);
  const [showDoneConfetti, setShowDoneConfetti] = useState(false);
  const doneOverlayShownRef = useRef(false);
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  // Canonical public base — always points to the published URL (no auth wall)
  const APP_BASE = import.meta.env.VITE_APP_URL
    || "https://2a7b3a81-afa0-4972-8146-b221f4dcb6aa.lovable.app";

  // Clear share URL when wrap changes so user re-shares with new wrap
  useEffect(() => {
    setShareUrl(null);
    setShareCopied(false);
  }, [selectedWrap]);

  const handleImageError = useCallback((pageId: string) => {
    setBrokenImagePageIds(prev => {
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
  }, []);

  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["pages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_pages")
        .select("*")
        .eq("project_id", id)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as Page[];
    },
    enabled: !!id,
  });

  const { data: illustrations = [] } = useQuery({
    queryKey: ["illustrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_illustrations")
        .select("id, page_id, storage_path, is_selected")
        .eq("project_id", id)
        .eq("is_selected", true);
      if (error) throw error;
      return data as (Illustration & { is_selected: boolean })[];
    },
    enabled: !!id,
  });

  const { data: allIllustrations = [] } = useQuery({
    queryKey: ["all-illustrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_illustrations")
        .select("id, page_id, storage_path, is_selected")
        .eq("project_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as (Illustration & { is_selected: boolean })[];
    },
    enabled: !!id,
  });

  // Dev report data — only fetched in dev mode
  const devMode = isDevMode();
  const { data: interviewMessages = [] } = useQuery({
    queryKey: ["interview", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_interview")
        .select("role, content, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!id && devMode,
  });
  const { data: buildLogs = [] } = useQuery({
    queryKey: ["build-log", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("build_log")
        .select("phase, level, message, technical_message, metadata, created_at")
        .eq("project_id", id)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!id && devMode,
  });
  const [devReportOpen, setDevReportOpen] = useState(false);

  const illustratedPageIds = new Set(illustrations.map(i => i.page_id));
  const missingCount = pages.filter(p => !illustratedPageIds.has(p.id) || brokenImagePageIds.has(p.id)).length;

  const illustrationUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    illustrations.forEach(ill => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
      map.set(ill.page_id, data.publicUrl);
    });
    return map;
  }, [illustrations]);

  const allIllustrationUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    allIllustrations.forEach(ill => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
      map.set(ill.id, data.publicUrl);
    });
    return map;
  }, [allIllustrations]);

  const illustrationsByPage = useMemo(() => {
    const map = new Map<string, (Illustration & { is_selected: boolean })[]>();
    allIllustrations.forEach(ill => {
      const list = map.get(ill.page_id) || [];
      list.push(ill);
      map.set(ill.page_id, list);
    });
    return map;
  }, [allIllustrations]);

  const [isSelectingIllustration, setIsSelectingIllustration] = useState(false);

  const handleSelectIllustration = async (pageId: string, illustrationId: string) => {
    if (!id) return;
    setIsSelectingIllustration(true);
    try {
      await supabase
        .from("project_illustrations")
        .update({ is_selected: false })
        .eq("page_id", pageId)
        .eq("project_id", id);
      await supabase
        .from("project_illustrations")
        .update({ is_selected: true })
        .eq("id", illustrationId);
      queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
      queryClient.invalidateQueries({ queryKey: ["all-illustrations", id] });
    } catch {
      toast.error("Failed to select illustration");
    } finally {
      setIsSelectingIllustration(false);
    }
  };

  const [isGeneratingVariant, setIsGeneratingVariant] = useState<string | null>(null);
  const [isRegeneratingText, setIsRegeneratingText] = useState<string | null>(null);
  const [isRegeneratingIll, setIsRegeneratingIll] = useState<string | null>(null);

  const handleTryAnother = async (pageId: string) => {
    if (!id || isGeneratingVariant) return;
    setIsGeneratingVariant(pageId);
    toast.info("Generating another variant...");
    let eid = "";
    const t0 = Date.now();
    if (isDevMode()) { eid = addEvent({ phase: "illustration", step: "try-another-variant", status: "running", model: "Gemini 3 Pro", input: JSON.stringify({ pageId, projectId: id }).slice(0, 500) }); }
    try {
      const { error } = await supabase.functions.invoke("generate-illustration", {
        body: { pageId, projectId: id, variant: true },
      });
      if (error) { if (isDevMode() && eid) updateEvent(eid, { status: "error", errorMessage: error.message, durationMs: Date.now() - t0 }); toast.error("Failed to generate variant"); return; }
      if (isDevMode() && eid) updateEvent(eid, { status: "success", durationMs: Date.now() - t0 });
      queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
      queryClient.invalidateQueries({ queryKey: ["all-illustrations", id] });
      toast.success("New variant generated!");
    } finally {
      setIsGeneratingVariant(null);
    }
  };

  const getIllustrationUrl = useCallback((pageId: string) => {
    return illustrationUrlMap.get(pageId) || null;
  }, [illustrationUrlMap]);

  const galleryPhotos = [...photos]
    .sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.sort_order - b.sort_order;
    });

  const galleryGridPages: GalleryGridPhoto[][] = [];
  for (let i = 0; i < galleryPhotos.length; i += 6) {
    galleryGridPages.push(
      galleryPhotos.slice(i, i + 6).map(photo => ({
        photoUrl: getPhotoUrl(photo.storage_path),
        caption: photo.caption,
      }))
    );
  }

  const virtualPages: VirtualPage[] = [
    ...pages.map(p => ({ type: "story" as const, page: p })),
    ...(galleryPhotos.length > 0 ? [
      // Skip gallery title page for 1-2 photos — just show photos inline
      ...(galleryPhotos.length > 2 ? [{ type: "photo_gallery_title" as const, petName: project?.pet_name || "Your Story" }] : []),
      ...galleryGridPages.map(photos => ({
        type: "photo_gallery_grid" as const,
        photos,
      })),
    ] : []),
  ];

  const spreads: [VirtualPage | null, VirtualPage | null][] = [];
  if (virtualPages.length > 0) {
    spreads.push([null, virtualPages[0]]);
    for (let i = 1; i < virtualPages.length; i += 2) {
      spreads.push([virtualPages[i], virtualPages[i + 1] || null]);
    }
  }

  const [selectedSide, setSelectedSide] = useState<"left" | "right">("right");
  const currentSpread = spreads[currentPage];
  const selectedVirtual = selectedSide === "left" ? currentSpread?.[0] : currentSpread?.[1];
  const isStoryPage = selectedVirtual?.type === "story";
  const storyPage = isStoryPage ? selectedVirtual.page : null;

  const approvedCount = pages.filter(p => p.is_approved).length;
  const approvalProgress = pages.length > 0 ? (approvedCount / pages.length) * 100 : 0;

  const updatePage = async (pageId: string, updates: Partial<Page>) => {
    const { error } = await supabase.from("project_pages").update(updates).eq("id", pageId);
    if (error) { toast.error("Failed to save"); return; }
    queryClient.invalidateQueries({ queryKey: ["pages", id] });
  };

  const approveAll = async () => {
    const { error } = await supabase
      .from("project_pages")
      .update({ is_approved: true })
      .eq("project_id", id);
    if (error) { toast.error("Failed to approve all"); return; }
    queryClient.invalidateQueries({ queryKey: ["pages", id] });
    // Show celebration overlay
    if (!doneOverlayShownRef.current) {
      doneOverlayShownRef.current = true;
      setShowDoneOverlay(true);
      setShowDoneConfetti(true);
      // Auto-generate share link for the overlay
      if (!shareUrl) handleShare();
    }
  };

  const handleRegenerateText = async (pageId: string) => {
    if (isRegeneratingText) return;
    setIsRegeneratingText(pageId);
    let eid = "";
    const t0 = Date.now();
    if (isDevMode()) { eid = addEvent({ phase: "story", step: "regenerate-page-text", status: "running", model: "GPT-5.2", input: JSON.stringify({ pageId, projectId: id }).slice(0, 500) }); }
    try {
      const { error } = await supabase.functions.invoke("regenerate-page", {
        body: { pageId, projectId: id },
      });
      if (error) { if (isDevMode() && eid) updateEvent(eid, { status: "error", errorMessage: error.message, durationMs: Date.now() - t0 }); toast.error("Failed to regenerate text"); return; }
      if (isDevMode() && eid) updateEvent(eid, { status: "success", durationMs: Date.now() - t0 });
      queryClient.invalidateQueries({ queryKey: ["pages", id] });
      toast.success("Page text regenerated!");
    } finally {
      setIsRegeneratingText(null);
    }
  };

  const handleRegenerateIllustration = async (pageId: string) => {
    if (isRegeneratingIll) return;
    setIsRegeneratingIll(pageId);
    let eid = "";
    const t0 = Date.now();
    if (isDevMode()) { eid = addEvent({ phase: "illustration", step: "regenerate-illustration", status: "running", model: "Gemini 3 Pro", input: JSON.stringify({ pageId, projectId: id }).slice(0, 500) }); }
    try {
      const { error } = await supabase.functions.invoke("generate-illustration", {
        body: { pageId, projectId: id, variant: true },
      });
      if (error) { if (isDevMode() && eid) updateEvent(eid, { status: "error", errorMessage: error.message, durationMs: Date.now() - t0 }); toast.error("Failed to regenerate illustration"); return; }
      if (isDevMode() && eid) updateEvent(eid, { status: "success", durationMs: Date.now() - t0 });
      queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
      toast.success("Illustration regenerated!");
    } finally {
      setIsRegeneratingIll(null);
    }
  };

  const handleGenerateMissing = async () => {
    if (!id) return;
    setIsGeneratingMissing(true);
    const missingPages = pages.filter(p => !illustratedPageIds.has(p.id) || brokenImagePageIds.has(p.id));
    let successes = 0;
    const succeededPageIds: string[] = [];

    for (const p of missingPages) {
      if (brokenImagePageIds.has(p.id)) {
        await supabase.from("project_illustrations").delete().eq("page_id", p.id).eq("project_id", id);
      }
    }

    const CONCURRENCY = 3;
    for (let i = 0; i < missingPages.length; i += CONCURRENCY) {
      const batch = missingPages.slice(i, i + CONCURRENCY);
      const batchEids: string[] = [];
      const t0 = Date.now();
      if (isDevMode()) {
        batch.forEach((p, bi) => { batchEids.push(addEvent({ phase: "illustration", step: `generate-missing page ${p.page_number}`, status: "running", model: "Gemini 3 Pro", input: JSON.stringify({ pageId: p.id, projectId: id }).slice(0, 500) })); });
      }
      const results = await Promise.allSettled(
        batch.map(p =>
          supabase.functions.invoke("generate-illustration", {
            body: { pageId: p.id, projectId: id },
          })
        )
      );
      for (let r = 0; r < results.length; r++) {
        const result = results[r];
        if (result.status === "fulfilled" && !result.value.error) {
          successes++;
          succeededPageIds.push(batch[r].id);
          if (isDevMode() && batchEids[r]) updateEvent(batchEids[r], { status: "success", durationMs: Date.now() - t0 });
        } else {
          if (isDevMode() && batchEids[r]) updateEvent(batchEids[r], { status: "error", errorMessage: "Generation failed", durationMs: Date.now() - t0 });
        }
      }
    }

    queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
    setIsGeneratingMissing(false);
    setBrokenImagePageIds(prev => {
      const next = new Set(prev);
      for (const pageId of succeededPageIds) {
        next.delete(pageId);
      }
      return next;
    });

    if (successes === missingPages.length) {
      toast.success("All missing illustrations generated!");
    } else {
      toast.error(`${missingPages.length - successes} illustration(s) still failed`);
    }
  };

  const handleDownloadPdf = async () => {
    if (!project) return;
    setIsDownloadingPdf(true);
    try {
      const storyPagesData = pages.map(p => ({
        pageNumber: p.page_number,
        pageType: p.page_type,
        textContent: p.text_content,
        illustrationUrl: getIllustrationUrl(p.id),
      }));

      const galleryData = galleryPhotos.map(photo => ({
        photoUrl: getPhotoUrl(photo.storage_path),
        caption: photo.caption,
      }));

      const { generatePdf } = await import("@/lib/generatePdf");
      await generatePdf({
        petName: project.pet_name,
        storyPages: storyPagesData,
        galleryPhotos: galleryData,
        onProgress: (stage) => setPdfProgress(stage),
      });

      setPdfProgress(null);
      toast.success("PDF downloaded!");
    } catch (e) {
      console.error("PDF generation failed:", e);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleShare = async () => {
    if (!id) return;
    setIsCreatingShare(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-share-link", {
        body: { projectId: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const url = `${APP_BASE}/book/${data.shareToken}${selectedWrap !== "classic" ? `?wrap=${selectedWrap}` : ""}`;
      setShareUrl(url);

      // Try native share sheet first (mobile), then clipboard fallback
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${project?.pet_name}'s Book`,
            text: "Check out this book I made!",
            url,
          });
          toast.success("Shared!");
          return;
        } catch (e) {
          // User cancelled native share — fall through to clipboard
          if ((e as DOMException)?.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        toast.success("Share link copied to clipboard!");
        setTimeout(() => setShareCopied(false), 3000);
      } catch {
        toast("Link created! Copy it: " + url, { duration: 8000 });
      }
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      toast("Copy this link: " + shareUrl, { duration: 8000 });
    }
  };

  const handleRebuildProfile = async () => {
    if (!id) return;
    setIsRebuildingProfile(true);
    let eid = "";
    const t0 = Date.now();
    if (isDevMode()) { eid = addEvent({ phase: "appearance-profile", step: "rebuild-appearance-profile", status: "running", model: "Gemini 2.5 Flash", input: JSON.stringify({ projectId: id }).slice(0, 500) }); }
    try {
      const { error } = await supabase.functions.invoke("build-appearance-profile", {
        body: { projectId: id },
      });
      if (error) { if (isDevMode() && eid) updateEvent(eid, { status: "error", errorMessage: error.message, durationMs: Date.now() - t0 }); toast.error("Failed to rebuild appearance profile"); return; }
      if (isDevMode() && eid) updateEvent(eid, { status: "success", durationMs: Date.now() - t0 });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Appearance profile rebuilt! Regenerate illustrations to see the effect.");
    } catch {
      if (isDevMode() && eid) updateEvent(eid, { status: "error", errorMessage: "Exception", durationMs: Date.now() - t0 });
      toast.error("Failed to rebuild appearance profile");
    } finally {
      setIsRebuildingProfile(false);
    }
  };

  const previewPages = [
    ...pages.map(p => ({
      pageNumber: p.page_number,
      pageType: p.page_type,
      textContent: p.text_content,
      illustrationUrl: getIllustrationUrl(p.id),
      galleryPhotos: undefined as GalleryGridPhoto[] | undefined,
    })),
    ...(galleryPhotos.length > 0 ? [
      // Skip gallery title for 1-2 photos
      ...(galleryPhotos.length > 2 ? [{
        pageNumber: pages.length + 1,
        pageType: "photo_gallery_title",
        textContent: `The Real ${project?.pet_name || ""}`,
        illustrationUrl: null,
        galleryPhotos: undefined as GalleryGridPhoto[] | undefined,
      }] : []),
      ...galleryGridPages.map((gridPhotos, i) => ({
        pageNumber: pages.length + (galleryPhotos.length > 2 ? 2 : 1) + i,
        pageType: "photo_gallery_grid",
        textContent: null,
        illustrationUrl: null,
        galleryPhotos: gridPhotos,
      })),
    ] : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto relative">
      {/* Book Done Celebration Overlay */}
      <AnimatePresence>
        {showDoneOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 bg-foreground/90" />
            <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-md w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 18 }}
              >
                <RabbitCharacter state="celebrating" size={100} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="text-center"
              >
                <h1 className="font-display text-4xl font-bold text-background">
                  Your book is done! 🎉
                </h1>
                <p className="font-body text-sm text-background/70 mt-2">
                  {project?.pet_name}'s story is ready to share with the world.
                </p>
              </motion.div>

              {/* Share link display */}
              {shareUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="w-full bg-background/10 rounded-2xl border border-background/20 px-4 py-3 flex items-center gap-3"
                >
                  <span className="font-body text-xs text-background/70 flex-1 truncate">{shareUrl}</span>
                  <button
                    onClick={handleCopyShare}
                    className="shrink-0 text-background/70 hover:text-background transition-colors"
                  >
                    {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.4 }}
                className="flex flex-col gap-3 w-full"
              >
                <motion.div
                  animate={{ boxShadow: ["0 0 0px 0px hsl(var(--primary)/0)", "0 0 24px 16px hsl(var(--primary)/0.35)", "0 0 0px 0px hsl(var(--primary)/0)"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="rounded-2xl"
                >
                  <Button
                    size="lg"
                    className="w-full rounded-2xl gap-2 py-6 text-base bg-background text-foreground hover:bg-background/90 shadow-2xl"
                    onClick={shareUrl ? handleCopyShare : handleShare}
                    disabled={isCreatingShare}
                  >
                    {isCreatingShare ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : shareCopied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Share2 className="w-5 h-5" />
                    )}
                    {isCreatingShare ? "Creating link..." : shareCopied ? "Copied!" : "Share This Book"}
                  </Button>
                </motion.div>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full rounded-2xl gap-2 py-5 text-sm border-background/30 text-background hover:bg-background/10"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                >
                  {isDownloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
                </Button>

                <button
                  onClick={() => setShowDoneOverlay(false)}
                  className="font-body text-sm text-background/50 hover:text-background/80 transition-colors py-2"
                >
                  Keep editing →
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfettiBurst trigger={showDoneConfetti} onComplete={() => setShowDoneConfetti(false)} />

      <div className="pb-16 px-4 md:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Share bar — glass treatment */}
          <div className="flex items-center gap-3 pt-4 mb-4 p-4 rounded-2xl glass-warm border border-primary/20 glow-soft">
            <Share2 className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold text-foreground">Share this book with anyone</p>
              {shareUrl && (
                <p className="font-body text-xs text-muted-foreground truncate">{shareUrl}</p>
              )}
            </div>
            {/* Gift wrap picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 shrink-0"
                >
                  <Palette className="w-4 h-4" />
                  <span className="hidden sm:inline">Wrap</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <p className="font-body text-xs text-muted-foreground mb-2 px-1">Gift wrap style</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {WRAP_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedWrap(opt.id)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-body transition-all",
                        selectedWrap === opt.id
                          ? "ring-2 ring-primary bg-primary/5"
                          : "hover:bg-secondary/50"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full border-2 shrink-0", opt.color)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {shareUrl ? (
              <Button
                size="sm"
                className="rounded-xl gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCopyShare}
              >
                {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {shareCopied ? "Copied!" : "Copy Link"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-xl gap-2 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleShare}
                disabled={isCreatingShare}
              >
                {isCreatingShare ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                {isCreatingShare ? "Creating..." : "Share This Book"}
              </Button>
            )}
          </div>

          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={onBack}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {project?.pet_name}'s Book
                </h1>
                <p className="font-body text-sm text-muted-foreground">Review and edit each page</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloadingPdf ? (pdfProgress || "PDF...") : "PDF"}
              </Button>
              <Button variant="hero" size="sm" className="rounded-xl gap-2" onClick={approveAll} disabled={approvedCount === pages.length}>
                <CheckCircle className="w-4 h-4" /> Approve All
              </Button>
              {/* More actions dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl w-9 h-9 p-0"
                  onClick={() => setMoreMenuOpen(prev => !prev)}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
                {moreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-card rounded-xl border border-border shadow-float z-50 min-w-[180px] py-1">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-foreground hover:bg-secondary/50 transition-colors"
                        onClick={() => { setPreviewOpen(true); setMoreMenuOpen(false); }}
                      >
                        <Eye className="w-4 h-4" /> Preview
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
                        onClick={() => { handleRebuildProfile(); setMoreMenuOpen(false); }}
                        disabled={isRebuildingProfile}
                      >
                        <ScanFace className="w-4 h-4" /> {isRebuildingProfile ? "Rebuilding..." : "Rebuild Profile"}
                      </button>
                      {missingCount > 0 && (
                        <button
                          className="flex items-center gap-2 w-full px-3 py-2 font-body text-sm text-destructive hover:bg-secondary/50 transition-colors disabled:opacity-50"
                          onClick={() => { handleGenerateMissing(); setMoreMenuOpen(false); }}
                          disabled={isGeneratingMissing}
                        >
                          <ImageIcon className="w-4 h-4" /> {isGeneratingMissing ? "Generating..." : `${missingCount} Missing`}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            <Progress value={approvalProgress} className="h-2 flex-1" />
            <span className="text-sm font-body text-muted-foreground whitespace-nowrap">
              {approvedCount} of {pages.length} approved
            </span>
          </div>

          {currentSpread ? (
            <div className="space-y-8">
              {/* Two-page spread with slide transition */}
              <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentPage}
                initial={{ opacity: 0, x: slideDirection * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: slideDirection * -40 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex gap-1 max-w-4xl mx-auto relative"
              >
                <div
                  className={cn(
                    "flex-1 cursor-pointer rounded-l-2xl overflow-hidden transition-shadow",
                    selectedSide === "left" && currentSpread[0] ? "ring-2 ring-primary/50 shadow-lg" : ""
                  )}
                  onClick={() => currentSpread[0] && setSelectedSide("left")}
                >
                  {currentSpread[0] ? (
                    <SpreadPageRenderer
                      vp={currentSpread[0]}
                      pagesCount={pages.length}
                      getIllustrationUrl={getIllustrationUrl}
                      handleImageError={handleImageError}
                    />
                  ) : (
                    <div className="aspect-square bg-gradient-to-b from-accent to-secondary rounded-l-2xl" />
                  )}
                </div>
                <div className="w-1 bg-gradient-to-r from-black/10 via-black/5 to-black/10 flex-shrink-0" />
                <div
                  className={cn(
                    "flex-1 cursor-pointer rounded-r-2xl overflow-hidden transition-shadow",
                    selectedSide === "right" && currentSpread[1] ? "ring-2 ring-primary/50 shadow-lg" : ""
                  )}
                  onClick={() => currentSpread[1] && setSelectedSide("right")}
                >
                  {currentSpread[1] ? (
                    <SpreadPageRenderer
                      vp={currentSpread[1]}
                      pagesCount={pages.length}
                      getIllustrationUrl={getIllustrationUrl}
                      handleImageError={handleImageError}
                    />
                  ) : (
                    <div className="aspect-square bg-gradient-to-b from-accent to-secondary rounded-r-2xl" />
                  )}
                </div>
              </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage === 0} onClick={() => { setSlideDirection(-1); setCurrentPage(p => p - 1); setSelectedSide("right"); }}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="font-body text-sm text-muted-foreground">
                  Spread {currentPage + 1} / {spreads.length}
                </span>
                <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage >= spreads.length - 1} onClick={() => { setSlideDirection(1); setCurrentPage(p => p + 1); setSelectedSide("left"); }}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Editor panel */}
              <div className="max-w-2xl mx-auto">
                {storyPage ? (
                  <>
                    {(() => {
                      const variants = illustrationsByPage.get(storyPage.id) || [];
                      if (variants.length <= 1) return null;
                      return (
                        <div className="mb-6">
                          <p className="text-xs font-body text-muted-foreground mb-2">
                            Choose illustration ({variants.length} options)
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {variants.map(v => {
                              const url = allIllustrationUrlMap.get(v.id);
                              return (
                                <button
                                  key={v.id}
                                  className={cn(
                                    "w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all",
                                    v.is_selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                                  )}
                                  onClick={() => handleSelectIllustration(storyPage.id, v.id)}
                                  disabled={isSelectingIllustration}
                                >
                                  {url && <img src={url} alt="Variant" className="w-full h-full object-cover" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <PageEditor
                      pageId={storyPage.id}
                      textContent={storyPage.text_content}
                      illustrationPrompt={storyPage.illustration_prompt}
                      isApproved={storyPage.is_approved}
                      onUpdateText={(text) => updatePage(storyPage.id, { text_content: text })}
                      onToggleApprove={(approved) => updatePage(storyPage.id, { is_approved: approved })}
                      onRegenerateText={() => handleRegenerateText(storyPage.id)}
                      onRegenerateIllustration={() => handleRegenerateIllustration(storyPage.id)}
                      onTryAnother={() => handleTryAnother(storyPage.id)}
                    />
                  </>
                ) : selectedVirtual ? (
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <p className="font-body text-muted-foreground">
                      {selectedVirtual.type === "photo_gallery_title"
                        ? "This is the gallery title page introducing the real photos section."
                        : "These are real photos from your collection. They will appear in the final book as-is."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <p className="font-body text-muted-foreground">Click a page above to select it.</p>
                  </div>
                )}
              </div>
            </div>
          ) : pagesLoading ? (
            <div className="space-y-8">
              <div className="flex gap-1 max-w-4xl mx-auto">
                <div className="flex-1 aspect-square rounded-l-2xl shimmer bg-primary/5" />
                <div className="w-1 bg-border/20" />
                <div className="flex-1 aspect-square rounded-r-2xl shimmer bg-primary/5" />
              </div>
              <p className="font-body text-sm text-muted-foreground text-center">Loading your book...</p>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="font-body text-muted-foreground">No pages generated yet.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Sticky floating share button — visible when scrolled past the share bar */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.3 }}
        >
          <Button
            size="sm"
            className="rounded-full h-12 px-5 gap-2 shadow-float bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={shareUrl ? handleCopyShare : handleShare}
            disabled={isCreatingShare}
          >
            {isCreatingShare ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : shareCopied ? (
              <Check className="w-4 h-4" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            {isCreatingShare ? "..." : shareCopied ? "Copied!" : "Share"}
          </Button>
        </motion.div>
      </div>

      {/* Dev Generation Report — only visible in dev mode */}
      {devMode && (
        <div className="mx-auto max-w-3xl px-4 pb-12">
          <Collapsible open={devReportOpen} onOpenChange={setDevReportOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left py-3 px-4 rounded-xl bg-muted/60 border border-border text-xs font-mono text-muted-foreground hover:bg-muted transition-colors">
                <span className="text-amber-500">⚙</span>
                <span className="font-semibold text-foreground">DEV: Generation Report</span>
                <ChevronDown className={cn("w-3.5 h-3.5 ml-auto transition-transform", devReportOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-xl border border-border bg-card p-5 space-y-5 font-mono text-xs">

                {/* What the user asked for */}
                <div>
                  <p className="text-amber-500 font-semibold mb-2">📝 USER'S CREATIVE BRIEF</p>
                  {interviewMessages.filter(m => m.role === "user").length === 0 ? (
                    <p className="text-muted-foreground italic">No user messages found in interview transcript.</p>
                  ) : (
                    <div className="space-y-2">
                      {interviewMessages.filter(m => m.role === "user").map((m, i) => (
                        <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                          <p className="text-muted-foreground text-[10px] mb-1">Message {i + 1}</p>
                          <p className="text-foreground">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inputs summary */}
                <div>
                  <p className="text-blue-400 font-semibold mb-2">📊 GENERATION INPUTS</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Interview messages", interviewMessages.length],
                      ["Photos", photos.length],
                      ["Mood", project?.mood || "none"],
                      ["Appearance profile", project?.pet_appearance_profile ? "✅ yes" : "❌ no"],
                      ["Photo context brief", project?.photo_context_brief ? "✅ yes" : "❌ no"],
                      ["Product type", project?.product_type || "storybook"],
                    ].map(([label, value]) => (
                      <div key={label as string} className="bg-muted/40 rounded-lg p-2">
                        <p className="text-muted-foreground text-[10px]">{label as string}</p>
                        <p className="text-foreground font-semibold">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What was generated */}
                <div>
                  <p className="text-green-400 font-semibold mb-2">📖 WHAT WAS GENERATED ({pages.length} pages)</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {pages.map(p => (
                      <div key={p.id} className="flex gap-2 items-start bg-muted/30 rounded-lg p-2">
                        <span className="text-muted-foreground shrink-0 w-6">p{p.page_number}</span>
                        <span className="text-foreground">{p.scene_description || p.text_content?.slice(0, 100) || <em className="text-muted-foreground">no content</em>}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Build log */}
                {buildLogs.length > 0 && (
                  <div>
                    <p className="text-purple-400 font-semibold mb-2">🔧 BUILD LOG ({buildLogs.length} entries)</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {buildLogs.map((log, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className={cn(
                            "shrink-0 text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase",
                            log.phase === "story" ? "bg-blue-500/20 text-blue-400" :
                            log.phase === "appearance" ? "bg-purple-500/20 text-purple-400" :
                            "bg-muted text-muted-foreground"
                          )}>{log.phase}</span>
                          <span className="text-muted-foreground">{log.technical_message || log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <BookPreview open={previewOpen} onOpenChange={setPreviewOpen} pages={previewPages} petName={project?.pet_name || ""} />
    </div>
  );
};

const SpreadPageRenderer = ({
  vp,
  pagesCount,
  getIllustrationUrl,
  handleImageError,
}: {
  vp: VirtualPage;
  pagesCount: number;
  getIllustrationUrl: (pageId: string) => string | null;
  handleImageError: (pageId: string) => void;
}) => {
  if (vp.type === "story") {
    return (
      <BookPageViewer
        pageNumber={vp.page.page_number}
        pageType={vp.page.page_type}
        textContent={vp.page.text_content}
        illustrationPrompt={vp.page.illustration_prompt}
        illustrationUrl={getIllustrationUrl(vp.page.id)}
        isApproved={vp.page.is_approved}
        onImageError={() => handleImageError(vp.page.id)}
        size="spread-half"
      />
    );
  }
  if (vp.type === "photo_gallery_title") {
    return (
      <BookPageViewer
        pageNumber={pagesCount + 1}
        pageType="photo_gallery_title"
        textContent={`The Real ${vp.petName}`}
        illustrationPrompt={null}
        isApproved={true}
        size="spread-half"
      />
    );
  }
  if (vp.type === "photo_gallery_grid") {
    return (
      <BookPageViewer
        pageNumber={0}
        pageType="photo_gallery_grid"
        textContent={null}
        illustrationPrompt={null}
        isApproved={true}
        galleryPhotos={vp.photos}
        size="spread-half"
      />
    );
  }
  return null;
};

export default BookReview;
