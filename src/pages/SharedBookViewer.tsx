import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import { supabase } from "@/integrations/supabase/client";

type BookPage = {
  id: string;
  pageNumber: number;
  pageType: string;
  textContent: string | null;
  illustrationUrl: string | null;
};

type GalleryPhoto = {
  photoUrl: string;
  caption: string | null;
};

type SharedBook = {
  petName: string;
  petType: string;
  pages: BookPage[];
  galleryPhotos: GalleryPhoto[];
};

const SharedBookViewer = () => {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [book, setBook] = useState<SharedBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spreadIdx, setSpreadIdx] = useState(0);

  useEffect(() => {
    if (!shareToken) return;

    const fetchBook = async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("get-shared-book", {
          body: { shareToken },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setBook(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Book not found");
      } finally {
        setLoading(false);
      }
    };

    fetchBook();
  }, [shareToken]);

  // Build gallery grid pages (groups of 6)
  const galleryGridPages: GalleryPhoto[][] = [];
  if (book) {
    for (let i = 0; i < book.galleryPhotos.length; i += 6) {
      galleryGridPages.push(book.galleryPhotos.slice(i, i + 6));
    }
  }

  // Build all virtual pages
  type VirtualPage = {
    type: "story";
    page: BookPage;
  } | {
    type: "gallery_title";
    petName: string;
  } | {
    type: "gallery_grid";
    photos: GalleryPhoto[];
  };

  const virtualPages: VirtualPage[] = book ? [
    ...book.pages.map(p => ({ type: "story" as const, page: p })),
    ...(book.galleryPhotos.length > 0 ? [
      { type: "gallery_title" as const, petName: book.petName },
      ...galleryGridPages.map(photos => ({ type: "gallery_grid" as const, photos })),
    ] : []),
  ] : [];

  // Build spreads
  const spreads: [VirtualPage | null, VirtualPage | null][] = [];
  if (virtualPages.length > 0) {
    spreads.push([null, virtualPages[0]]);
    for (let i = 1; i < virtualPages.length; i += 2) {
      spreads.push([virtualPages[i], virtualPages[i + 1] || null]);
    }
  }

  const currentSpread = spreads[spreadIdx];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" && spreadIdx > 0) {
      setSpreadIdx(s => s - 1);
    } else if (e.key === "ArrowRight" && spreadIdx < spreads.length - 1) {
      setSpreadIdx(s => s + 1);
    }
  }, [spreadIdx, spreads.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <RabbitCharacter state="thinking" size={120} />
          <div className="flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="font-body text-sm text-muted-foreground">Loading book...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <RabbitCharacter state="sympathetic" size={120} />
          <h1 className="font-display text-2xl font-bold text-foreground">
            Book Not Found
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            This link may have expired or the book may have been removed.
          </p>
          <Link to="/">
            <Button className="rounded-xl mt-4 bg-primary text-primary-foreground">
              Create Your Own
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <RabbitCharacter state="idle" size={32} />
          <span className="font-display text-lg font-bold text-foreground">PhotoRabbit</span>
        </Link>
        <Link to="/">
          <Button size="sm" className="rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <BookOpen className="w-4 h-4" /> Make Your Own
          </Button>
        </Link>
      </header>

      {/* Book title */}
      <div className="text-center py-4">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {book.petName}'s Book
        </h1>
        <p className="font-body text-sm mt-1 text-muted-foreground">
          Made with PhotoRabbit
        </p>
      </div>

      {/* Book spread */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
        {currentSpread && (
          <motion.div
            key={spreadIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex max-w-4xl w-full shadow-2xl rounded-2xl overflow-hidden border border-border"
          >
            {/* Left page */}
            <div className="flex-1 overflow-hidden">
              {renderSharedPage(currentSpread[0])}
            </div>
            {/* Spine */}
            <div className="w-1 flex-shrink-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.08), transparent, rgba(0,0,0,0.08))" }} />
            {/* Right page */}
            <div className="flex-1 overflow-hidden">
              {renderSharedPage(currentSpread[1])}
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-6 mt-6">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border border-border"
            disabled={spreadIdx === 0}
            onClick={() => setSpreadIdx(s => s - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <span className="font-body text-sm text-muted-foreground">
            {spreadIdx + 1} / {spreads.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-2 border border-border"
            disabled={spreadIdx >= spreads.length - 1}
            onClick={() => setSpreadIdx(s => s + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* CTA footer — strong viral loop */}
      <div className="text-center py-10 border-t border-border bg-gradient-to-b from-background to-primary/5">
        <RabbitCharacter state="presenting" size={100} />
        <h2 className="font-display text-2xl font-bold mt-4 text-foreground">
          Make your own picture book
        </h2>
        <p className="font-body text-sm mt-2 text-muted-foreground max-w-md mx-auto">
          Drop any photos — pets, kids, trips, couples — and I'll write and illustrate a custom book in minutes. Free to try.
        </p>
        <Link to="/">
          <Button size="lg" className="rounded-xl mt-5 px-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-base shadow-lg hover:shadow-xl transition-all">
            <Camera className="w-5 h-5" />
            Start With Your Photos
          </Button>
        </Link>
      </div>
    </div>
  );
};

type VirtualPageType = {
  type: "story";
  page: { pageType: string; textContent: string | null; illustrationUrl: string | null; pageNumber: number };
} | {
  type: "gallery_title";
  petName: string;
} | {
  type: "gallery_grid";
  photos: { photoUrl: string; caption: string | null }[];
};

function renderSharedPage(vp: VirtualPageType | null) {
  if (!vp) {
    return (
      <div className="aspect-square bg-gradient-to-b from-accent to-secondary" />
    );
  }

  if (vp.type === "gallery_title") {
    return (
      <div className="aspect-square flex items-center justify-center bg-gradient-to-b from-accent to-secondary">
        <div className="text-center space-y-3 p-8">
          <Camera className="w-10 h-10 mx-auto text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">
            The Real {vp.petName}
          </h2>
        </div>
      </div>
    );
  }

  if (vp.type === "gallery_grid") {
    return (
      <div className="aspect-square p-3 bg-gradient-to-b from-accent to-white">
        <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full">
          {vp.photos.map((photo, i) => (
            <div key={i} className="rounded-lg overflow-hidden shadow-sm flex flex-col border border-border">
              <div className="flex-1 min-h-0">
                <img src={photo.photoUrl} alt={photo.caption || `Photo ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
              {photo.caption && (
                <p className="font-body text-[8px] text-center px-1 py-0.5 truncate text-muted-foreground">
                  {photo.caption}
                </p>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 6 - vp.photos.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="rounded-lg flex items-center justify-center border border-border/25 bg-background/50">
              <Camera className="w-5 h-5 text-border/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Story page
  const { page } = vp;
  const isDedication = page.pageType === "dedication";
  const isCover = page.pageType === "cover";

  return (
    <div className="aspect-square relative overflow-hidden bg-card">
      {page.illustrationUrl ? (
        <img src={page.illustrationUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-border/25">
          <BookOpen className="w-12 h-12" />
        </div>
      )}
      {/* Dedication wash */}
      {isDedication && page.illustrationUrl && (
        <div className="absolute inset-0" style={{ background: "rgba(254, 247, 238, 0.88)" }} />
      )}
      {/* Cover top wash */}
      {isCover && page.illustrationUrl && (
        <div className="absolute top-0 left-0 right-0 h-[30%]" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.6), transparent)" }} />
      )}
      {/* Dedication centered text */}
      {isDedication && page.textContent && (
        <div className="absolute inset-0 flex items-center justify-center z-10 px-8">
          <p className="font-display text-base italic leading-relaxed text-center text-foreground/80">
            {page.textContent}
          </p>
        </div>
      )}
      {/* Cover/story text overlay */}
      {!isDedication && page.textContent && (
        <div className="absolute bottom-0 left-0 right-0 pt-10 pb-4 px-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.3), transparent)" }}>
          <p className={`font-display text-sm leading-relaxed text-white text-center drop-shadow-md ${isCover ? "font-bold text-base" : ""}`}>
            {page.textContent}
          </p>
        </div>
      )}
    </div>
  );
}

export default SharedBookViewer;
