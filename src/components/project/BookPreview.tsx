import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Camera } from "lucide-react";

interface BookPage {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
  photoUrl?: string | null;
  photoCaption?: string | null;
}

interface BookPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: BookPage[];
  petName: string;
}

const BookPreview = ({ open, onOpenChange, pages, petName }: BookPreviewProps) => {
  const [current, setCurrent] = useState(0);
  const page = pages[current];

  // Reset to first page when opening
  useEffect(() => {
    if (open) setCurrent(0);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowLeft" && current > 0) {
      setCurrent(c => c - 1);
    } else if (e.key === "ArrowRight" && current < pages.length - 1) {
      setCurrent(c => c + 1);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }, [open, current, pages.length, onOpenChange]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isPhotoGallery = page?.pageType === "photo_gallery";
  const isGalleryTitle = page?.pageType === "photo_gallery_title";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 rounded-2xl overflow-hidden border-none bg-card [&>button]:hidden">
        {page && (
          <>
            {/* Image / Photo area */}
            <div className="aspect-square bg-secondary relative">
              {isGalleryTitle ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                  <Camera className="w-16 h-16 text-primary/60 mb-4" />
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    {page.textContent}
                  </h2>
                </div>
              ) : isPhotoGallery ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-card">
                  {page.photoUrl ? (
                    <div className="flex-1 w-full flex items-center justify-center p-4">
                      <div className="rounded-lg overflow-hidden shadow-lg border-4 border-white dark:border-gray-700 max-w-[75%] max-h-[70%]">
                        <img
                          src={page.photoUrl}
                          alt={page.photoCaption || "Pet photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  ) : (
                    <Camera className="w-16 h-16 text-muted-foreground/30" />
                  )}
                  {page.photoCaption && (
                    <p className="font-body text-sm italic text-muted-foreground text-center mt-4 px-6 max-w-md">
                      {page.photoCaption}
                    </p>
                  )}
                </div>
              ) : page.illustrationUrl ? (
                <img
                  src={page.illustrationUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                  No illustration
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-full"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Text (for story pages) */}
            {!isPhotoGallery && !isGalleryTitle && page.textContent && (
              <div className="p-8 text-center">
                <p className="font-display text-lg leading-relaxed text-foreground">
                  {page.textContent}
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between px-6 pb-6">
              <Button
                variant="ghost"
                size="sm"
                disabled={current === 0}
                onClick={() => setCurrent(c => c - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground font-body">
                {current + 1} / {pages.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={current >= pages.length - 1}
                onClick={() => setCurrent(c => c + 1)}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookPreview;
