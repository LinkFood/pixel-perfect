import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface BookPage {
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 rounded-2xl overflow-hidden border-none bg-card [&>button]:hidden">
        {page && (
          <>
            {/* Image */}
            <div className="aspect-[4/3] bg-secondary relative">
              {page.illustrationUrl ? (
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

            {/* Text */}
            <div className="p-8 text-center">
              <p className="font-display text-lg leading-relaxed text-foreground">
                {page.textContent}
              </p>
            </div>

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
