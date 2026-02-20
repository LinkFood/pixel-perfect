import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, Camera, AlertTriangle } from "lucide-react";

type GalleryGridPhoto = {
  photoUrl: string;
  caption: string | null;
};

interface BookPageViewerProps {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationPrompt: string | null;
  illustrationUrl?: string | null;
  isApproved: boolean;
  onImageError?: () => void;
  // Photo gallery props
  photoUrl?: string | null;
  photoCaption?: string | null;
  // Gallery grid props
  galleryPhotos?: GalleryGridPhoto[];
  // Layout mode
  size?: "full" | "spread-half";
}

const BookPageViewer = ({ pageNumber, pageType, textContent, illustrationPrompt, illustrationUrl, isApproved, onImageError, photoUrl, photoCaption, galleryPhotos, size = "full" }: BookPageViewerProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset image state when illustration URL changes (e.g. variant selection)
  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [illustrationUrl]);

  const handleError = () => {
    setImgError(true);
    onImageError?.();
  };

  const isPhotoGallery = pageType === "photo_gallery";
  const isGalleryTitle = pageType === "photo_gallery_title";
  const isGalleryGrid = pageType === "photo_gallery_grid";
  const isHalf = size === "spread-half";

  // Gallery title page
  if (isGalleryTitle) {
    const galleryTitle = textContent && textContent !== "Photo Gallery" ? textContent : "The Real Moments";
    return (
      <div className="rounded-2xl border-2 overflow-hidden bg-card border-primary/20">
        <div className="aspect-square flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="text-center space-y-4 p-8">
            <Camera className={cn("text-primary/60 mx-auto", isHalf ? "w-10 h-10" : "w-16 h-16")} />
            <h2 className={cn("font-display font-bold text-foreground", isHalf ? "text-lg" : "text-2xl")}>
              {galleryTitle}
            </h2>
            <p className={cn("font-body text-muted-foreground italic", isHalf ? "text-xs" : "text-sm")}>
              Behind the scenes
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Gallery grid page — 2x3 grid of photos
  if (isGalleryGrid && galleryPhotos) {
    return (
      <div className="rounded-2xl border-2 overflow-hidden bg-card border-primary/20">
        <div className="aspect-square bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-card p-3">
          <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full">
            {galleryPhotos.map((photo, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-border/50 flex flex-col">
                <div className="flex-1 min-h-0">
                  <img
                    src={photo.photoUrl}
                    alt={photo.caption || `Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                {photo.caption && (
                  <p className={cn(
                    "font-body text-center text-muted-foreground px-1 py-0.5 truncate",
                    isHalf ? "text-[8px]" : "text-[10px]"
                  )}>
                    {photo.caption}
                  </p>
                )}
              </div>
            ))}
            {/* Fill empty slots if fewer than 6 */}
            {Array.from({ length: Math.max(0, 6 - galleryPhotos.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="rounded-lg bg-secondary/30 border border-border/30 flex items-center justify-center">
                <Camera className="w-6 h-6 text-muted-foreground/20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Photo gallery page — real uploaded photo with caption (legacy single)
  if (isPhotoGallery) {
    return (
      <div className="rounded-2xl border-2 overflow-hidden bg-card border-primary/20">
        <div className="aspect-square flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-card">
          {photoUrl ? (
            <div className="flex-1 w-full flex items-center justify-center p-4">
              <div className="relative rounded-lg overflow-hidden shadow-lg border-4 border-white dark:border-gray-700 max-w-[80%] max-h-[70%]">
                <img
                  src={photoUrl}
                  alt={photoCaption || "Photo"}
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    imgLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImgLoaded(true)}
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full flex items-center justify-center">
              <Camera className="w-16 h-16 text-muted-foreground/30" />
            </div>
          )}
          {photoCaption && (
            <p className="font-body text-sm italic text-muted-foreground text-center mt-4 px-4 max-w-md">
              {photoCaption}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Dedication page — illustration with heavy wash, centered text
  if (pageType === "dedication") {
    return (
      <div className={cn(
        "rounded-2xl border-2 overflow-hidden bg-card transition-colors",
        isApproved ? "border-primary/30" : "border-border"
      )}>
        <div className="aspect-square relative overflow-hidden">
          {illustrationUrl && !imgError ? (
            <>
              <img
                src={illustrationUrl}
                alt="Dedication illustration"
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
                onLoad={() => setImgLoaded(true)}
                onError={handleError}
                loading="lazy"
              />
              {/* Heavy cream wash to hide AI text artifacts */}
              <div className="absolute inset-0 bg-amber-50/[0.88] dark:bg-background/90" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-background" />
          )}
          {/* Page label */}
          <div className="absolute top-3 left-3 z-10">
            <span className="text-xs font-body text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
              Dedication
            </span>
          </div>
          {/* Centered dedication text */}
          <div className="absolute inset-0 flex items-center justify-center z-10 px-10">
            <p className={cn(
              "font-display italic leading-relaxed text-foreground/80 text-center drop-shadow-sm",
              isHalf ? "text-base" : "text-xl"
            )}>
              {textContent || "Dedication text will appear here..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Cover page — illustration with top wash to hide AI text, title at bottom
  if (pageType === "cover") {
    return (
      <div className={cn(
        "rounded-2xl border-2 overflow-hidden bg-card transition-colors book-page-texture",
        isApproved ? "border-primary/30" : "border-border"
      )}>
        <div className="aspect-square relative overflow-hidden">
          {illustrationUrl && !imgError ? (
            <>
              <img
                src={illustrationUrl}
                alt="Cover illustration"
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-500",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
                style={{ boxShadow: "inset 0 0 40px hsl(12 85% 56% / 0.15)" }}
                onLoad={() => setImgLoaded(true)}
                onError={handleError}
                loading="lazy"
              />
              {/* Top wash to hide garbled AI text */}
              <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/90 via-white/60 to-transparent dark:from-background/90 dark:via-background/60" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-background" />
          )}
          {/* Page label */}
          <div className="absolute top-3 left-3 z-10">
            <span className="text-xs font-body text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
              Cover
            </span>
          </div>
          {/* Title overlay at bottom */}
          {textContent && (
            <div className="absolute bottom-0 left-0 right-0 bg-white/85 backdrop-blur-sm pt-4 pb-5 px-5">
              <p
                className={cn(
                  "font-display font-bold leading-relaxed text-foreground text-center",
                  isHalf ? "text-xl" : "text-3xl"
                )}
              >
                {textContent}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard story page — full-bleed illustration with text overlay
  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden bg-card transition-colors book-page-texture",
      isApproved ? "border-primary/30" : "border-border"
    )}>
      <div className="aspect-square bg-secondary/50 relative overflow-hidden">
        {illustrationUrl && !imgError ? (
          <img
            src={illustrationUrl}
            alt={`Page ${pageNumber} illustration`}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-500",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImgLoaded(true)}
            onError={handleError}
            loading="lazy"
          />
        ) : illustrationUrl && imgError ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-2 p-6">
              <AlertTriangle className="w-12 h-12 text-destructive/60 mx-auto" />
              <p className="text-xs text-destructive font-body">Illustration is corrupt — click "Regenerate" to fix</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-2 p-6">
              <ImageIcon className="w-12 h-12 text-muted-foreground/40 mx-auto" />
              <p className="text-xs text-muted-foreground font-body max-w-[200px]">
                {illustrationPrompt ? illustrationPrompt.slice(0, 100) + "..." : "Illustration will appear here"}
              </p>
            </div>
          </div>
        )}
        {/* Page label */}
        <div className="absolute top-3 left-3">
          <span className="text-xs font-body text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
            {pageType === "closing" ? "Closing"
              : pageType === "back_cover" ? "Back Cover"
              : `Page ${pageNumber}`}
          </span>
        </div>
        {/* Text overlay at bottom */}
        {textContent && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/85 backdrop-blur-sm pt-4 pb-5 px-5">
            <p className={cn(
              "font-display leading-relaxed text-foreground text-center",
              isHalf ? "text-sm" : "text-base"
            )}>
              {textContent}
            </p>
          </div>
        )}
        {!textContent && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/70 backdrop-blur-sm pt-3 pb-4 px-5">
            <p className={cn("font-display leading-relaxed text-muted-foreground text-center italic", isHalf ? "text-xs" : "text-sm")}>
              Text will appear here after generation...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookPageViewer;
