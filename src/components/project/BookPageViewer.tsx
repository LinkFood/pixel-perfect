import { useState } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon, Camera, AlertTriangle } from "lucide-react";

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
}

const BookPageViewer = ({ pageNumber, pageType, textContent, illustrationPrompt, illustrationUrl, isApproved, onImageError, photoUrl, photoCaption }: BookPageViewerProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleError = () => {
    setImgError(true);
    onImageError?.();
  };

  const isPhotoGallery = pageType === "photo_gallery";
  const isGalleryTitle = pageType === "photo_gallery_title";

  // Gallery title page
  if (isGalleryTitle) {
    return (
      <div className="rounded-2xl border-2 overflow-hidden bg-card border-primary/20">
        <div className="aspect-square flex items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <div className="text-center space-y-4 p-8">
            <Camera className="w-16 h-16 text-primary/60 mx-auto" />
            <h2 className="font-display text-2xl font-bold text-foreground">
              {textContent}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // Photo gallery page — real uploaded photo with caption
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

  // Standard story page
  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden bg-card transition-colors",
      isApproved ? "border-primary/30" : "border-border"
    )}>
      {/* Illustration */}
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
        <div className="absolute top-3 left-3">
          <span className="text-xs font-body text-muted-foreground bg-background/80 backdrop-blur-sm rounded-full px-2.5 py-1">
            {pageType === "cover" ? "Cover"
              : pageType === "dedication" ? "Dedication"
              : pageType === "closing" ? "Closing"
              : pageType === "back_cover" ? "Back Cover"
              : `Page ${pageNumber}`}
          </span>
        </div>
      </div>
      {/* Text content */}
      <div className="p-6">
        <p className="font-display text-base leading-relaxed text-foreground">
          {textContent || "Text will appear here after generation..."}
        </p>
      </div>
    </div>
  );
};

export default BookPageViewer;
