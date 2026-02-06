import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

interface BookPageViewerProps {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationPrompt: string | null;
  isApproved: boolean;
}

const BookPageViewer = ({ pageNumber, pageType, textContent, illustrationPrompt, isApproved }: BookPageViewerProps) => {
  return (
    <div className={cn(
      "rounded-2xl border-2 overflow-hidden bg-card transition-colors",
      isApproved ? "border-primary/30" : "border-border"
    )}>
      {/* Illustration placeholder */}
      <div className="aspect-[4/3] bg-secondary/50 flex items-center justify-center relative">
        <div className="text-center space-y-2 p-6">
          <ImageIcon className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground font-body max-w-[200px]">
            {illustrationPrompt ? illustrationPrompt.slice(0, 100) + "..." : "Illustration will appear here"}
          </p>
        </div>
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
