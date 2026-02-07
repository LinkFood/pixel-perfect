import { useState } from "react";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

interface BookPageViewerProps {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationPrompt: string | null;
  illustrationUrl?: string | null;
  isApproved: boolean;
}

const BookPageViewer = ({ pageNumber, pageType, textContent, illustrationPrompt, illustrationUrl, isApproved }: BookPageViewerProps) => {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden bg-card transition-colors",
      isApproved ? "border-primary/30" : "border-border"
    )}>
      {/* Illustration */}
      <div className="aspect-[4/3] bg-secondary/50 relative overflow-hidden">
        {illustrationUrl ? (
          <img
            src={illustrationUrl}
            alt={`Page ${pageNumber} illustration`}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-500",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImgLoaded(true)}
          />
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
            {pageType === "cover" ? "Cover" : pageType === "dedication" ? "Dedication" : `Page ${pageNumber}`}
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
