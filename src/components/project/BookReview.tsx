import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle, Eye, Download, ImageIcon, RefreshCw, Loader2, ScanFace, Share2, Copy, Check, ArrowLeft, MoreHorizontal } from "lucide-react";
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

type Page = {
  id: string;
  page_number: number;
  page_type: string;
  text_content: string | null;
  illustration_prompt: string | null;
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

const BookReview = ({ projectId, onBack }: BookReviewProps) => {
  const id = projectId;
  const { data: project } = useProject(id);
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
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  const handleImageError = useCallback((pageId: string) => {
    setBrokenImagePageIds(prev => {
      const next = new Set(prev);
      next.add(pageId);
      return next;
    });
  }, []);

  const { data: pages = [] } = useQuery({
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

  const handleTryAnother = async (pageId: string) => {
    if (!id) return;
    toast.info("Generating another variant...");
    const { error } = await supabase.functions.invoke("generate-illustration", {
      body: { pageId, projectId: id, variant: true },
    });
    if (error) { toast.error("Failed to generate variant"); return; }
    queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
    queryClient.invalidateQueries({ queryKey: ["all-illustrations", id] });
    toast.success("New variant generated!");
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
      { type: "photo_gallery_title" as const, petName: project?.pet_name || "Your Story" },
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
    toast.success("All pages approved!");
  };

  const handleRegenerateText = async (pageId: string) => {
    const { error } = await supabase.functions.invoke("regenerate-page", {
      body: { pageId, projectId: id },
    });
    if (error) { toast.error("Failed to regenerate text"); return; }
    queryClient.invalidateQueries({ queryKey: ["pages", id] });
    toast.success("Page text regenerated!");
  };

  const handleRegenerateIllustration = async (pageId: string) => {
    const { error } = await supabase.functions.invoke("generate-illustration", {
      body: { pageId, projectId: id },
    });
    if (error) { toast.error("Failed to regenerate illustration"); return; }
    queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
    toast.success("Illustration regenerated!");
  };

  const handleGenerateMissing = async () => {
    if (!id) return;
    setIsGeneratingMissing(true);
    const missingPages = pages.filter(p => !illustratedPageIds.has(p.id) || brokenImagePageIds.has(p.id));
    let successes = 0;

    for (const p of missingPages) {
      if (brokenImagePageIds.has(p.id)) {
        await supabase.from("project_illustrations").delete().eq("page_id", p.id).eq("project_id", id);
      }
    }

    for (const p of missingPages) {
      try {
        const { error } = await supabase.functions.invoke("generate-illustration", {
          body: { pageId: p.id, projectId: id },
        });
        if (!error) successes++;
      } catch (e) {
        console.error(`Failed for page ${p.id}:`, e);
      }
    }

    queryClient.invalidateQueries({ queryKey: ["illustrations", id] });
    setIsGeneratingMissing(false);
    setBrokenImagePageIds(new Set());

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
      });

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
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-page?token=${data.shareToken}`;
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
    try {
      const { error } = await supabase.functions.invoke("build-appearance-profile", {
        body: { projectId: id },
      });
      if (error) { toast.error("Failed to rebuild appearance profile"); return; }
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success("Appearance profile rebuilt! Regenerate illustrations to see the effect.");
    } catch {
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
      {
        pageNumber: pages.length + 1,
        pageType: "photo_gallery_title",
        textContent: `The Real ${project?.pet_name || ""}`,
        illustrationUrl: null,
        galleryPhotos: undefined as GalleryGridPhoto[] | undefined,
      },
      ...galleryGridPages.map((gridPhotos, i) => ({
        pageNumber: pages.length + 2 + i,
        pageType: "photo_gallery_grid",
        textContent: null,
        illustrationUrl: null,
        galleryPhotos: gridPhotos,
      })),
    ] : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto">
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
                {isDownloadingPdf ? "PDF..." : "PDF"}
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
                    <div className="aspect-square bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-l-2xl" />
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
                    <div className="aspect-square bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-r-2xl" />
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
