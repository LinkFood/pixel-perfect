import { useState } from "react";
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
    return (
      <div className="rounded-2xl border-2 overflow-hidden bg-card border-primary/20">
        <div className="aspect-square flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="text-center space-y-4 p-8">
            <Camera className={cn("text-primary/60 mx-auto", isHalf ? "w-10 h-10" : "w-16 h-16")} />
            <h2 className={cn("font-display font-bold text-foreground", isHalf ? "text-lg" : "text-2xl")}>
              {textContent}
            </h2>
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
                  alt={photoCaption || `Photo of pet`}
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-500",
                    imgLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImgLoaded(true)}
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

  // Standard story page — full-bleed illustration with text overlay
  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden bg-card transition-colors",
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
            {pageType === "cover" ? "Cover"
              : pageType === "dedication" ? "Dedication"
              : pageType === "closing" ? "Closing"
              : pageType === "back_cover" ? "Back Cover"
              : `Page ${pageNumber}`}
          </span>
        </div>
        {/* Text overlay at bottom */}
        {textContent && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-12 pb-5 px-5">
            <p className={cn(
              "font-display leading-relaxed text-white text-center drop-shadow-md",
              isHalf ? "text-sm" : "text-base"
            )}>
              {textContent}
            </p>
          </div>
        )}
        {!textContent && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent pt-8 pb-4 px-5">
            <p className={cn("font-display leading-relaxed text-white/60 text-center italic", isHalf ? "text-xs" : "text-sm")}>
              Text will appear here after generation...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookPageViewer;
