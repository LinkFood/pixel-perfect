import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Camera } from "lucide-react";

type GalleryGridPhoto = {
  photoUrl: string;
  caption: string | null;
};

interface BookPage {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
  galleryPhotos?: GalleryGridPhoto[];
}

interface BookPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: BookPage[];
  petName: string;
}

const BookPreview = ({ open, onOpenChange, pages, petName }: BookPreviewProps) => {
  // Spread index: each spread shows 2 pages
  const [spreadIdx, setSpreadIdx] = useState(0);

  // Build spreads: cover alone (right side), then pairs, back cover alone
  const spreads: [BookPage | null, BookPage | null][] = [];
  if (pages.length > 0) {
    // First spread: blank left + cover right
    spreads.push([null, pages[0]]);
    // Middle spreads: pairs
    for (let i = 1; i < pages.length - 1; i += 2) {
      spreads.push([pages[i], pages[i + 1] || null]);
    }
    // If odd number of remaining pages, last page is right-only
    if (pages.length > 1 && (pages.length - 1) % 2 === 1) {
      spreads.push([pages[pages.length - 1], null]);
    }
  }

  const currentSpread = spreads[spreadIdx];
  const totalSpreads = spreads.length;

  useEffect(() => {
    if (open) setSpreadIdx(0);
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowLeft" && spreadIdx > 0) {
      setSpreadIdx(s => s - 1);
    } else if (e.key === "ArrowRight" && spreadIdx < totalSpreads - 1) {
      setSpreadIdx(s => s + 1);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }, [open, spreadIdx, totalSpreads, onOpenChange]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const renderPage = (page: BookPage | null, side: "left" | "right") => {
    if (!page) {
      // Blank endpaper
      return (
        <div className="flex-1 aspect-square bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30" />
      );
    }

    const isGalleryTitle = page.pageType === "photo_gallery_title";
    const isGalleryGrid = page.pageType === "photo_gallery_grid";

    if (isGalleryTitle) {
      return (
        <div className="flex-1 aspect-square flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <Camera className="w-10 h-10 text-primary/60 mb-3" />
          <h2 className="font-display text-lg font-bold text-foreground">
            {page.textContent}
          </h2>
        </div>
      );
    }

    if (isGalleryGrid && page.galleryPhotos) {
      return (
        <div className="flex-1 aspect-square bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-card p-2">
          <div className="grid grid-cols-2 grid-rows-3 gap-1.5 h-full">
            {page.galleryPhotos.map((photo, i) => (
              <div key={i} className="rounded overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-border/50 flex flex-col">
                <div className="flex-1 min-h-0">
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || `Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {photo.caption && (
                  <p className="font-body text-[7px] text-center text-muted-foreground px-0.5 py-0.5 truncate">
                    {photo.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const isDedication = page.pageType === "dedication";
    const isCover = page.pageType === "cover";

    // Story page — full-bleed with text overlay
    return (
      <div className="flex-1">
        <div className="aspect-square bg-secondary relative">
          {page.illustrationUrl ? (
            <img
              src={page.illustrationUrl}
              alt={`Page ${page.pageNumber}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-xs">
              No illustration
            </div>
          )}
          {/* Dedication: heavy wash to hide AI text artifacts */}
          {isDedication && page.illustrationUrl && (
            <div className="absolute inset-0 bg-amber-50/[0.88] dark:bg-background/90" />
          )}
          {/* Cover: top wash to hide garbled AI text */}
          {isCover && page.illustrationUrl && (
            <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/90 via-white/60 to-transparent dark:from-background/90 dark:via-background/60" />
          )}
          {/* Dedication: centered text */}
          {isDedication && page.textContent && (
            <div className="absolute inset-0 flex items-center justify-center z-10 px-8">
              <p className="font-display text-lg italic leading-relaxed text-foreground/80 text-center drop-shadow-sm">
                {page.textContent}
              </p>
            </div>
          )}
          {/* Cover/story: text overlay at bottom */}
          {!isDedication && page.textContent && (
            <div className="absolute bottom-0 left-0 right-0 bg-white/85 backdrop-blur-sm pt-4 pb-4 px-4">
              <p className={`font-display text-sm leading-relaxed text-foreground text-center ${isCover ? "font-bold text-base" : ""}`}>
                {page.textContent}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 rounded-2xl overflow-hidden border-none bg-card [&>button]:hidden">
        {currentSpread && (
          <>
            {/* Two-page spread with spine */}
            <div className="flex relative">
              {/* Left page */}
              <div className="flex-1 bg-card border-r border-border/30 overflow-hidden">
                {renderPage(currentSpread[0], "left")}
              </div>
              {/* Spine shadow */}
              <div className="absolute left-1/2 top-0 bottom-0 w-4 -translate-x-1/2 bg-gradient-to-r from-black/10 via-transparent to-black/10 pointer-events-none z-10" />
              {/* Right page */}
              <div className="flex-1 bg-card overflow-hidden">
                {renderPage(currentSpread[1], "right")}
              </div>
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-full z-20"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between px-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                disabled={spreadIdx === 0}
                onClick={() => setSpreadIdx(s => s - 1)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground font-body">
                {spreadIdx + 1} / {totalSpreads}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={spreadIdx >= totalSpreads - 1}
                onClick={() => setSpreadIdx(s => s + 1)}
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
