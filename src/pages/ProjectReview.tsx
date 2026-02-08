import { useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle, Eye, Download, ImageIcon, RefreshCw, Loader2, ScanFace } from "lucide-react";
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
import Navbar from "@/components/landing/Navbar";
// generatePdf is dynamically imported when user clicks Download

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

// Virtual page type for combined story + gallery view
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

const ProjectReview = () => {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: photos = [] } = usePhotos(id);
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isRebuildingProfile, setIsRebuildingProfile] = useState(false);
  const [brokenImagePageIds, setBrokenImagePageIds] = useState<Set<string>>(new Set());

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
        .eq("project_id", id!)
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
        .eq("project_id", id!)
        .eq("is_selected", true);
      if (error) throw error;
      return data as (Illustration & { is_selected: boolean })[];
    },
    enabled: !!id,
  });

  // All illustrations (including non-selected variants) for the picker
  const { data: allIllustrations = [] } = useQuery({
    queryKey: ["all-illustrations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_illustrations")
        .select("id, page_id, storage_path, is_selected")
        .eq("project_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as (Illustration & { is_selected: boolean })[];
    },
    enabled: !!id,
  });

  const illustratedPageIds = new Set(illustrations.map(i => i.page_id));
  const missingCount = pages.filter(p => !illustratedPageIds.has(p.id) || brokenImagePageIds.has(p.id)).length;

  // Memoize URL map so getPublicUrl isn't called on every render
  const illustrationUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    illustrations.forEach(ill => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
      map.set(ill.page_id, data.publicUrl);
    });
    return map;
  }, [illustrations]);

  // Build URL map for ALL illustrations (variants included)
  const allIllustrationUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    allIllustrations.forEach(ill => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
      map.set(ill.id, data.publicUrl);
    });
    return map;
  }, [allIllustrations]);

  // Group all illustrations by page_id
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
      // Deselect all for this page
      await supabase
        .from("project_illustrations")
        .update({ is_selected: false })
        .eq("page_id", pageId)
        .eq("project_id", id);
      // Select the chosen one
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

  // Build virtual pages: story pages + photo gallery
  const galleryPhotos = [...photos]
    .sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.sort_order - b.sort_order;
    });

  // Group gallery photos into pages of 6
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
      { type: "photo_gallery_title" as const, petName: project?.pet_name || "Your Pet" },
      ...galleryGridPages.map(photos => ({
        type: "photo_gallery_grid" as const,
        photos,
      })),
    ] : []),
  ];

  // Build spreads for two-page view: [left, right] pairs
  const spreads: [VirtualPage | null, VirtualPage | null][] = [];
  if (virtualPages.length > 0) {
    // Cover alone on right
    spreads.push([null, virtualPages[0]]);
    for (let i = 1; i < virtualPages.length; i += 2) {
      spreads.push([virtualPages[i], virtualPages[i + 1] || null]);
    }
    // If we ended with an odd remaining, the last push already handled it
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
      .eq("project_id", id!);
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

    // Delete broken illustration records first so they can be regenerated
    for (const p of missingPages) {
      if (brokenImagePageIds.has(p.id)) {
        await supabase.from("project_illustrations").delete().eq("page_id", p.id).eq("project_id", id!);
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

  // Build preview pages (story + gallery grids)
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
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {project?.pet_name}'s Book
              </h1>
              <p className="font-body text-muted-foreground mt-1">Review and edit each page</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleRebuildProfile}
                disabled={isRebuildingProfile}
              >
                {isRebuildingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanFace className="w-4 h-4" />
                )}
                {isRebuildingProfile ? "Rebuilding..." : "Rebuild Profile"}
              </Button>
              {missingCount > 0 && (
                <Button
                  variant="destructive"
                  className="rounded-xl gap-2"
                  onClick={handleGenerateMissing}
                  disabled={isGeneratingMissing}
                >
                  {isGeneratingMissing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  {isGeneratingMissing ? "Generating..." : `Generate ${missingCount} Missing`}
                </Button>
              )}
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => setPreviewOpen(true)}>
                <Eye className="w-4 h-4" /> Preview
              </Button>
              <Button
                variant="outline"
                className="rounded-xl gap-2"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
              </Button>
              <Button variant="hero" className="rounded-xl gap-2" onClick={approveAll} disabled={approvedCount === pages.length}>
                <CheckCircle className="w-4 h-4" /> Approve All
              </Button>
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
              {/* Two-page spread */}
              <div className="flex gap-1 max-w-4xl mx-auto relative">
                {/* Left page */}
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
                {/* Spine shadow */}
                <div className="w-1 bg-gradient-to-r from-black/10 via-black/5 to-black/10 flex-shrink-0" />
                {/* Right page */}
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
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-6">
                <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage === 0} onClick={() => { setCurrentPage(p => p - 1); setSelectedSide("right"); }}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="font-body text-sm text-muted-foreground">
                  Spread {currentPage + 1} / {spreads.length}
                </span>
                <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage >= spreads.length - 1} onClick={() => { setCurrentPage(p => p + 1); setSelectedSide("left"); }}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Editor panel below spread (full width) */}
              <div className="max-w-2xl mx-auto">
                {storyPage ? (
                  <>
                    {/* Illustration variant picker */}
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
      </main>

      <BookPreview open={previewOpen} onOpenChange={setPreviewOpen} pages={previewPages} petName={project?.pet_name || ""} />
    </div>
  );
};

// Helper to render a virtual page in the spread view
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

export default ProjectReview;
