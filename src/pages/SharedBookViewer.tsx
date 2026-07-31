import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, BookOpen, Camera, Share2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ConfettiBurst from "@/components/ConfettiBurst";
import { supabase } from "@/integrations/supabase/client";
import { bookTitle, displayPetName } from "@/lib/petName";

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
  const [revealed, setRevealed] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showShareConfetti, setShowShareConfetti] = useState(false);
  const hasSharedRef = useRef(false);
  const [searchParams] = useSearchParams();
  const wrapStyle = searchParams.get("wrap") || "classic";
  const wrap = getWrapTheme(wrapStyle);

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

  // Book title: prefer the cover page's text (the real title); pet_name may
  // hold a whole sentence on older projects, so it's only a sanitized fallback
  const coverText = book?.pages?.find(p => p.pageType === "cover")?.textContent;
  const title = bookTitle(coverText, book?.petName);

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

  const virtualPages: VirtualPage[] = book?.pages ? [
    ...book.pages.map(p => ({ type: "story" as const, page: p })),
    ...(book.galleryPhotos?.length > 0 ? [
      { type: "gallery_title" as const, petName: displayPetName(book.petName) },
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

  const companionState: RabbitState = useMemo(() => {
    if (spreadIdx === 0) return "presenting";
    if (spreadIdx >= spreads.length - 1) return "celebrating";
    const cycle: RabbitState[] = ["listening", "thinking", "excited", "painting"];
    return cycle[spreadIdx % cycle.length];
  }, [spreadIdx, spreads.length]);

  const progressLabel = useMemo(() => {
    if (spreads.length === 0) return "";
    const ratio = spreadIdx / (spreads.length - 1);
    if (spreadIdx === 0) return "The beginning...";
    if (ratio < 0.25) return "Once upon a time...";
    if (ratio < 0.5) return "The story unfolds...";
    if (ratio < 0.75) return "Almost there...";
    if (spreadIdx >= spreads.length - 1) return "The end";
    return "The story unfolds...";
  }, [spreadIdx, spreads.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only navigation keys should interrupt the autoplay reveal — previously any
    // keypress (including spacebar scroll) silently killed it.
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    setAutoPlaying(false);
    setProgress(0);
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

  // Touch swipe navigation for mobile
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 50;
    if (dx < -threshold && spreadIdx < spreads.length - 1) {
      setAutoPlaying(false);
      setProgress(0);
      setSpreadIdx(s => s + 1);
    } else if (dx > threshold && spreadIdx > 0) {
      setAutoPlaying(false);
      setProgress(0);
      setSpreadIdx(s => s - 1);
    }
    touchStartX.current = null;
  }, [spreadIdx, spreads.length]);

  // Share It Forward
  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title,
      text: "Check out this picture book!",
      url: shareUrl,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied!");
      }
      if (!hasSharedRef.current) {
        hasSharedRef.current = true;
        setShowShareConfetti(true);
      }
    } catch {
      // User cancelled share dialog — ignore
    }
  }, [title]);

  // Auto-flip timer
  const AUTO_FLIP_DURATION = 7000;
  useEffect(() => {
    if (!autoPlaying || !revealed || spreadIdx >= spreads.length - 1) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + (50 / AUTO_FLIP_DURATION) * 100;
        if (next >= 100) {
          setSpreadIdx((s) => {
            const nextIdx = s + 1;
            if (nextIdx >= spreads.length - 1) {
              setAutoPlaying(false);
            }
            return nextIdx;
          });
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [autoPlaying, revealed, spreadIdx, spreads.length]);

  if (error && !loading) {
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
    <AnimatePresence mode="wait">
      {!revealed ? (
        <motion.div
          key="gift"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          className={`min-h-screen flex items-center justify-center ${wrap.bg}`}
        >
          <div className="text-center space-y-6 max-w-sm px-6">
            <RabbitCharacter state="presenting" size={140} />
            <div className={`${wrapStyle === "midnight" ? "bg-white/10 backdrop-blur" : "bg-card"} border ${wrap.border} rounded-2xl shadow-xl p-8 space-y-4`}>
              <h1 className={`font-display text-2xl font-bold ${wrap.text}`}>
                Someone made this book just for you
              </h1>
              <p className={`font-body text-sm ${wrapStyle === "midnight" ? "text-white/70" : "text-muted-foreground"}`}>
                A one-of-a-kind picture book, illustrated by a rabbit.
              </p>
              <Button
                size="lg"
                className="rounded-xl px-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-base shadow-lg hover:shadow-xl transition-all w-full"
                disabled={loading}
                onClick={() => setRevealed(true)}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Unwrapping...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-5 h-5" />
                    Open
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="book"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="h-screen flex flex-col bg-background overflow-hidden"
        >
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
              {title}
            </h1>
            <p className="font-body text-sm mt-1 text-muted-foreground">
              Made with PhotoRabbit
            </p>
          </div>

          {/* Book spread */}
          <div
            className="flex-1 flex flex-col items-center justify-center px-4 pb-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {currentSpread && (
              <motion.div
                key={spreadIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="relative flex flex-col max-w-4xl w-full shadow-2xl rounded-2xl overflow-hidden border border-border cursor-pointer"
                onClick={() => { setAutoPlaying(false); setProgress(0); }}
              >
                <div className="flex flex-1">
                  {/* Left page */}
                  <div className="flex-1 overflow-hidden">
                    {renderSharedPage(currentSpread[0])}
                  </div>
                  {/* Spine */}
                  <div className="w-1 flex-shrink-0 bg-gradient-to-r from-black/[0.08] via-transparent to-black/[0.08]" />
                  {/* Right page */}
                  <div className="flex-1 overflow-hidden">
                    {renderSharedPage(currentSpread[1])}
                  </div>
                </div>
                {/* Auto-flip progress bar */}
                {autoPlaying && (
                  <div className="h-[2px] w-full bg-border/20">
                    <div
                      className="h-full bg-primary/60"
                      style={{ width: `${progress}%`, transition: "width 50ms linear" }}
                    />
                  </div>
                )}
                {/* Companion rabbit */}
                <motion.div
                  key={`companion-${spreadIdx}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="absolute bottom-2 right-2 z-10"
                >
                  <RabbitCharacter state={companionState} size={48} />
                </motion.div>
              </motion.div>
            )}

            {/* Navigation */}
            <div className="flex items-center gap-4 sm:gap-6 mt-6 flex-wrap justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 border border-border"
                disabled={spreadIdx === 0}
                onClick={() => { setAutoPlaying(false); setProgress(0); setSpreadIdx(s => s - 1); }}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <div className="flex flex-col items-center">
                <span className="font-display text-sm text-foreground/70 italic">
                  {progressLabel}
                </span>
                <span className="font-body text-[10px] text-muted-foreground/50">
                  {spreadIdx + 1} / {spreads.length}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 border border-border"
                disabled={spreadIdx >= spreads.length - 1}
                onClick={() => { setAutoPlaying(false); setProgress(0); setSpreadIdx(s => s + 1); }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
              {!autoPlaying && spreadIdx < spreads.length - 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2 border border-border"
                  onClick={() => { setAutoPlaying(true); setProgress(0); }}
                >
                  <Play className="w-3 h-3" /> Auto-play
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2 border border-border"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>

          {/* CTA footer — strong viral loop */}
          <div className="shrink-0 text-center py-6 border-t border-border bg-gradient-to-b from-background to-primary/5">
            <RabbitCharacter state="presenting" size={120} />
            <h2 className="font-display text-3xl font-bold mt-5 text-foreground">
              I loved making this book.
            </h2>
            <p className="font-body text-base mt-3 text-muted-foreground max-w-md mx-auto">
              Want me to make one for you?
            </p>
            <Link to="/">
              <Button size="lg" className="rounded-xl mt-6 px-12 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                <Camera className="w-5 h-5" />
                Let's Make a Book
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
      <ConfettiBurst trigger={showShareConfetti} onComplete={() => setShowShareConfetti(false)} />
    </AnimatePresence>
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

// Caption may be null or the literal string "null" from failed captioning runs
function cleanCaption(caption: string | null): string | null {
  const t = caption?.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "undefined") return null;
  return t;
}

/**
 * "The Real ___" photo grid. Renders only photos that actually load —
 * a slot whose image errors is removed and the grid re-flows to fit,
 * so there are never empty camera-icon placeholders.
 */
function SharedGalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [failedIdx, setFailedIdx] = useState<Set<number>>(new Set());
  const visible = photos
    .map((photo, i) => ({ photo, i }))
    .filter(({ photo, i }) => photo.photoUrl && !failedIdx.has(i));

  const gridClass =
    visible.length <= 1 ? "grid-cols-1 grid-rows-1"
    : visible.length === 2 ? "grid-cols-1 grid-rows-2"
    : visible.length <= 4 ? "grid-cols-2 grid-rows-2"
    : "grid-cols-2 grid-rows-3";

  if (visible.length === 0) {
    return (
      <div className="aspect-square flex items-center justify-center bg-gradient-to-b from-accent to-white">
        <Camera className="w-8 h-8 text-border/40" />
      </div>
    );
  }

  return (
    <div className="aspect-square p-3 bg-gradient-to-b from-accent to-white">
      <div className={`grid ${gridClass} gap-2 h-full`}>
        {visible.map(({ photo, i }) => {
          const caption = cleanCaption(photo.caption);
          return (
            <div key={i} className="rounded-lg overflow-hidden shadow-sm flex flex-col border border-border">
              <div className="flex-1 min-h-0">
                <img
                  src={photo.photoUrl}
                  alt={caption || `Photo ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setFailedIdx(prev => new Set(prev).add(i))}
                />
              </div>
              {caption && (
                <p className="font-body text-[8px] text-center px-1 py-0.5 truncate text-muted-foreground">
                  {caption}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StoryPageImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 shimmer bg-primary/5" />}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </>
  );
}

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
    return <SharedGalleryGrid photos={vp.photos} />;
  }

  // Story page
  const { page } = vp;
  const isDedication = page.pageType === "dedication";
  const isCover = page.pageType === "cover";

  return (
    <div className="aspect-square relative overflow-hidden bg-card">
      {page.illustrationUrl ? (
        <StoryPageImage src={page.illustrationUrl} alt={`Page ${page.pageNumber}`} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-border/25">
          <BookOpen className="w-12 h-12" />
        </div>
      )}
      {/* Dedication wash */}
      {isDedication && page.illustrationUrl && (
        <div className="absolute inset-0 bg-amber-50/[0.88]" />
      )}
      {/* Cover top wash */}
      {isCover && page.illustrationUrl && (
        <div className="absolute top-0 left-0 right-0 h-[30%] bg-gradient-to-b from-white/90 via-white/60 to-transparent" />
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
        <div className="absolute bottom-0 left-0 right-0 pt-4 pb-4 px-4 bg-white/85 backdrop-blur-sm">
          <p className={`font-display text-sm leading-relaxed text-foreground text-center ${isCover ? "font-bold text-base" : ""}`}>
            {page.textContent}
          </p>
        </div>
      )}
    </div>
  );
}

export default SharedBookViewer;
