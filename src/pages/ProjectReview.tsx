import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CheckCircle, Eye, Download, ImageIcon, RefreshCw, Loader2 } from "lucide-react";
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
import Navbar from "@/components/landing/Navbar";
import { generatePdf } from "@/lib/generatePdf";

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

// Virtual page type for combined story + gallery view
type VirtualPage = {
  type: "story";
  page: Page;
} | {
  type: "photo_gallery_title";
  petName: string;
} | {
  type: "photo_gallery";
  photoUrl: string;
  caption: string | null;
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
        .select("id, page_id, storage_path")
        .eq("project_id", id!)
        .eq("is_selected", true);
      if (error) throw error;
      return data as Illustration[];
    },
    enabled: !!id,
  });

  const illustratedPageIds = new Set(illustrations.map(i => i.page_id));
  const missingCount = pages.filter(p => !illustratedPageIds.has(p.id) || brokenImagePageIds.has(p.id)).length;

  const getIllustrationUrl = (pageId: string) => {
    const ill = illustrations.find(i => i.page_id === pageId);
    if (!ill) return null;
    const { data } = supabase.storage.from("pet-photos").getPublicUrl(ill.storage_path);
    return data.publicUrl;
  };

  // Build virtual pages: story pages + photo gallery
  const galleryPhotos = [...photos]
    .sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return a.sort_order - b.sort_order;
    });

  const virtualPages: VirtualPage[] = [
    ...pages.map(p => ({ type: "story" as const, page: p })),
    ...(galleryPhotos.length > 0 ? [
      { type: "photo_gallery_title" as const, petName: project?.pet_name || "Your Pet" },
      ...galleryPhotos.map(photo => ({
        type: "photo_gallery" as const,
        photoUrl: getPhotoUrl(photo.storage_path),
        caption: photo.caption,
      })),
    ] : []),
  ];

  const currentVirtual = virtualPages[currentPage];
  const isStoryPage = currentVirtual?.type === "story";
  const storyPage = isStoryPage ? currentVirtual.page : null;

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

  // Build preview pages (story + gallery)
  const previewPages = [
    ...pages.map(p => ({
      pageNumber: p.page_number,
      pageType: p.page_type,
      textContent: p.text_content,
      illustrationUrl: getIllustrationUrl(p.id),
      photoUrl: null as string | null,
      photoCaption: null as string | null,
    })),
    ...(galleryPhotos.length > 0 ? [
      {
        pageNumber: pages.length + 1,
        pageType: "photo_gallery_title",
        textContent: `The Real ${project?.pet_name || ""}`,
        illustrationUrl: null,
        photoUrl: null,
        photoCaption: null,
      },
      ...galleryPhotos.map((photo, i) => ({
        pageNumber: pages.length + 2 + i,
        pageType: "photo_gallery",
        textContent: photo.caption,
        illustrationUrl: null,
        photoUrl: getPhotoUrl(photo.storage_path),
        photoCaption: photo.caption,
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

          {currentVirtual ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Page Viewer */}
              {currentVirtual.type === "story" && (
                <BookPageViewer
                  pageNumber={currentVirtual.page.page_number}
                  pageType={currentVirtual.page.page_type}
                  textContent={currentVirtual.page.text_content}
                  illustrationPrompt={currentVirtual.page.illustration_prompt}
                  illustrationUrl={getIllustrationUrl(currentVirtual.page.id)}
                  isApproved={currentVirtual.page.is_approved}
                  onImageError={() => handleImageError(currentVirtual.page.id)}
                />
              )}
              {currentVirtual.type === "photo_gallery_title" && (
                <BookPageViewer
                  pageNumber={pages.length + 1}
                  pageType="photo_gallery_title"
                  textContent={`The Real ${currentVirtual.petName}`}
                  illustrationPrompt={null}
                  isApproved={true}
                />
              )}
              {currentVirtual.type === "photo_gallery" && (
                <BookPageViewer
                  pageNumber={currentPage + 1}
                  pageType="photo_gallery"
                  textContent={currentVirtual.caption}
                  illustrationPrompt={null}
                  isApproved={true}
                  photoUrl={currentVirtual.photoUrl}
                  photoCaption={currentVirtual.caption}
                />
              )}

              {/* Right: Editor (only for story pages) */}
              <div className="space-y-6">
                {storyPage ? (
                  <PageEditor
                    pageId={storyPage.id}
                    textContent={storyPage.text_content}
                    illustrationPrompt={storyPage.illustration_prompt}
                    isApproved={storyPage.is_approved}
                    onUpdateText={(text) => updatePage(storyPage.id, { text_content: text })}
                    onToggleApprove={(approved) => updatePage(storyPage.id, { is_approved: approved })}
                    onRegenerateText={() => handleRegenerateText(storyPage.id)}
                    onRegenerateIllustration={() => handleRegenerateIllustration(storyPage.id)}
                  />
                ) : (
                  <div className="bg-card rounded-2xl border border-border p-8 text-center">
                    <p className="font-body text-muted-foreground">
                      {currentVirtual.type === "photo_gallery_title"
                        ? "This is the gallery title page introducing the real photos section."
                        : "This is a real photo from your collection. It will appear in the final book as-is."}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4">
                  <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Button>
                  <span className="font-body text-sm text-muted-foreground">
                    {currentPage + 1} / {virtualPages.length}
                  </span>
                  <Button variant="outline" className="rounded-xl gap-2" disabled={currentPage >= virtualPages.length - 1} onClick={() => setCurrentPage(p => p + 1)}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
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

export default ProjectReview;
