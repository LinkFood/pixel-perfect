import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import PhotoUploadInline from "./PhotoUploadInline";
import GenerationView from "./GenerationView";
import BookReview from "@/components/project/BookReview";
import DevStatusBar from "./DevStatusBar";
import { isDevMode } from "@/lib/devMode";
import { ChainLogProvider } from "@/hooks/useChainLog";
import { type ProjectPhoto } from "@/hooks/usePhotos";
import { supabase } from "@/integrations/supabase/client";
import ConfettiBurst from "@/components/ConfettiBurst";
import MoodPicker from "./MoodPicker";
import { useState, useEffect, useRef } from "react";

type Phase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

interface WorkspaceSandboxProps {
  phase: Phase;
  // Photo props
  photos: ProjectPhoto[];
  isBatchUploading: boolean;
  uploadProgress?: { total: number; completed: number; failed: number };
  captioningIds?: Set<string>;
  onPhotoUpload: (files: File[]) => void;
  onToggleFavorite?: (photoId: string, current: boolean) => void;
  onDeletePhoto?: (photoId: string, storagePath: string) => void;
  canContinueToInterview: boolean;
  onContinueToInterview: () => void;
  // Mood props
  petName: string;
  onMoodSelect: (mood: string, name: string) => void;
  // Interview props
  canFinish: boolean;
  allowQuickFinish?: boolean;
  userInterviewCount?: number;
  onFinishInterview: () => void;
  isFinishing?: boolean;
  // Generation props
  activeProjectId: string | null;
  onGenerationComplete: () => void;
  onNewIllustration?: (pageNum: number, url: string) => void;
  interviewHighlights?: string[];
  mood?: string | null;
  productType?: "single_illustration" | "short_story" | "picture_book";
  // Credit/cost props
  tokenCost?: number;
  creditBalance?: number | null;
  // Review props
  onBackFromReview: () => void;
  // Dev status props
  dbStatus?: string;
}

const WorkspaceSandbox = ({
  phase,
  photos,
  isBatchUploading,
  uploadProgress,
  captioningIds,
  onPhotoUpload,
  onToggleFavorite,
  onDeletePhoto,
  canContinueToInterview,
  onContinueToInterview,
  petName,
  onMoodSelect,
  canFinish,
  allowQuickFinish = false,
  userInterviewCount = 0,
  onFinishInterview,
  isFinishing = false,
  activeProjectId,
  onGenerationComplete,
  onNewIllustration,
  interviewHighlights,
  mood,
  productType = "picture_book",
  tokenCost = 0,
  creditBalance = null,
  onBackFromReview,
  dbStatus,
}: WorkspaceSandboxProps) => {
  const shouldReduceMotion = useReducedMotion();
  const [showMoodOverride, setShowMoodOverride] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [revealReady, setRevealReady] = useState(false);
  const [coverIllustrationUrl, setCoverIllustrationUrl] = useState<string | null>(null);
  const prevPhaseRef = useRef<Phase>(phase);

  // Fetch cover illustration URL when transitioning to review
  useEffect(() => {
    if (phase === "review" && prevPhaseRef.current === "generating" && activeProjectId) {
      setShowReveal(true);
      setRevealReady(false);

      // Fetch cover illustration (wrapped in try/catch so reveal never traps the user)
      const fetchCover = async () => {
        try {
          const { data: coverPage } = await supabase
            .from("project_pages")
            .select("id")
            .eq("project_id", activeProjectId)
            .eq("page_type", "cover")
            .single();
          if (coverPage) {
            const { data: coverIll } = await supabase
              .from("project_illustrations")
              .select("storage_path")
              .eq("page_id", coverPage.id)
              .eq("is_selected", true)
              .single();
            if (coverIll) {
              const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(coverIll.storage_path);
              setCoverIllustrationUrl(urlData.publicUrl);
            }
          }
        } catch (err) {
          console.error("Failed to fetch cover for reveal:", err);
        }
      };
      fetchCover();
      // Start timer in parallel with cover fetch
      setTimeout(() => setRevealReady(true), 3000);
    }
    prevPhaseRef.current = phase;
  }, [phase, activeProjectId]);

  const dismissReveal = () => {
    setShowConfetti(true);
    setShowReveal(false);
    setCoverIllustrationUrl(null);
  };

  // Escape key dismisses reveal overlay (safety hatch)
  useEffect(() => {
    if (!showReveal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissReveal();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showReveal]);

  return (
    <ChainLogProvider>
    <div className="flex flex-col h-full overflow-hidden">
      {isDevMode() && (
        <DevStatusBar
          phase={phase}
          dbStatus={dbStatus}
          mood={mood}
          photoCount={photos.length}
          projectId={activeProjectId}
        />
      )}
      <AnimatePresence mode="wait">
        {/* Upload phase */}
        {(phase === "home" || phase === "upload") && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col p-6 gap-4"
          >
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">
                {photos.length === 0
                  ? "Drop photos to start"
                  : photos.length === 1
                    ? "Your Photo"
                    : photos.length < 6
                      ? `Your Photos (${photos.length})`
                      : `${photos.length} photos — looking great!`}
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                {photos.length === 0
                  ? "Pets, kids, trips, couples — anything with a story"
                  : photos.length === 1
                    ? "One photo = one beautiful illustration"
                    : photos.length < 6
                      ? "A few photos make a short story"
                      : "Enough for a full picture book"}
              </p>
            </div>

            <PhotoUploadInline
              photos={photos}
              isUploading={isBatchUploading}
              uploadProgress={isBatchUploading ? uploadProgress : undefined}
              captioningIds={captioningIds}
              onUpload={onPhotoUpload}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDeletePhoto}
            />

            {canContinueToInterview && phase === "upload" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2">
                <Button
                  size="lg"
                  className="rounded-xl gap-2 px-8 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={onContinueToInterview}
                >
                  {photos.length === 1
                    ? "Continue with this photo"
                    : photos.length < 6
                      ? "That's my photos — let's go!"
                      : "That's all my photos — let's go!"}
                </Button>
                <p className="font-body text-xs mt-2 text-muted-foreground">
                  {photos.length === 1 ? "Or add more for a richer story" : "Or keep adding more photos"}
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Mood-picker + Interview — photo grid stays visible */}
        {(phase === "mood-picker" || phase === "interview") && (
          <motion.div
            key="interview-workspace"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col p-6 gap-4"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {phase === "mood-picker" ? "Your Photos" : "Tell Me About Them"}
                </h2>
                {phase === "interview" && mood && (
                  <button
                    onClick={() => setShowMoodOverride(prev => !prev)}
                    className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50"
                  >
                    Vibe: {mood.startsWith("custom:") ? mood.slice(7).trim() : mood} · change
                  </button>
                )}
              </div>
              <p className="font-body text-sm text-muted-foreground">
                {phase === "mood-picker"
                  ? "Setting up your interview..."
                  : "Chat with Rabbit — share memories, stories, personality"}
              </p>
            </div>

            <PhotoUploadInline
              photos={photos}
              isUploading={isBatchUploading}
              uploadProgress={isBatchUploading ? uploadProgress : undefined}
              captioningIds={captioningIds}
              onUpload={onPhotoUpload}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDeletePhoto}
            />

            {/* Optional mood override */}
            <AnimatePresence>
              {showMoodOverride && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <MoodPicker
                    petName={petName}
                    onSelect={(newMood, name) => {
                      onMoodSelect(newMood, name);
                      setShowMoodOverride(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1" />

            {phase === "interview" && !canFinish && !allowQuickFinish && (
              <p className="font-body text-xs text-muted-foreground text-center py-2 italic">
                The more you share, the better your book will be.
              </p>
            )}

            {phase === "interview" && (canFinish || allowQuickFinish) && (() => {
              const buttonText = productType === "single_illustration"
                ? "Illustrate this!"
                : productType === "short_story"
                  ? "Make my story!"
                  : userInterviewCount >= 8 ? "Paint my book!" : "Make my book!";
              const subtitle = productType === "single_illustration"
                ? "One photo, one stunning illustration."
                : productType === "short_story"
                  ? "A short and sweet story from your photos."
                  : userInterviewCount >= 8
                    ? "I have everything I need. Let's make something incredible."
                    : userInterviewCount >= 6
                      ? "You've shared great stuff. Ready when you are."
                      : "Or keep sharing — the more you tell me, the richer the story.";
              const glowSpread = userInterviewCount >= 8 ? "16px" : userInterviewCount >= 6 ? "12px" : "8px";
              const glowOpacity = userInterviewCount >= 8 ? "0.25" : userInterviewCount >= 6 ? "0.2" : "0.15";

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-4"
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 0 0 hsl(var(--primary) / 0.3)",
                        `0 0 20px ${glowSpread} hsl(var(--primary) / ${glowOpacity})`,
                        "0 0 0 0 hsl(var(--primary) / 0.3)",
                      ],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-block rounded-2xl"
                  >
                    <Button
                      size="lg"
                      className="rounded-2xl gap-2 px-8 py-6 text-base bg-primary text-primary-foreground hover:bg-primary/90 shadow-elevated"
                      onClick={onFinishInterview}
                      disabled={isFinishing}
                    >
                      <CheckCircle className="w-5 h-5" /> {isFinishing ? "Starting..." : buttonText}
                    </Button>
                  </motion.div>
                  <p className="font-body text-xs mt-2 text-muted-foreground">
                    {subtitle}
                  </p>
                </motion.div>
              );
            })()}
          </motion.div>
        )}

        {/* Generating phase */}
        {phase === "generating" && activeProjectId && (
          <motion.div
            key="generating"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <GenerationView
              projectId={activeProjectId}
              petName={petName}
              onComplete={onGenerationComplete}
              hideRabbit={true}
              onNewIllustration={onNewIllustration}
              interviewHighlights={interviewHighlights}
              mood={mood}
              tokenCost={tokenCost}
              creditBalance={creditBalance}
            />
          </motion.div>
        )}

        {/* Review phase */}
        {phase === "review" && activeProjectId && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <BookReview projectId={activeProjectId} onBack={onBackFromReview} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic book reveal — fixed overlay, does NOT unmount GenerationView */}
      <AnimatePresence>
        {showReveal && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Warm-dark backdrop */}
            <motion.div
              className="absolute inset-0 bg-foreground/90"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-6 px-8 max-w-md">
              {/* Book title */}
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="font-display text-3xl md:text-4xl font-bold text-background text-center drop-shadow-lg"
              >
                {petName}'s Book
              </motion.h1>

              {/* Cover illustration with glow */}
              {coverIllustrationUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 1, type: "spring", stiffness: 120, damping: 20 }}
                  className="w-64 h-64 md:w-80 md:h-80 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ boxShadow: "0 0 60px 20px hsl(var(--primary) / 0.3)" }}
                >
                  <img
                    src={coverIllustrationUrl}
                    alt="Your book cover"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}

              {/* Fallback if no cover loaded yet */}
              {!coverIllustrationUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                  className="w-64 h-64 md:w-80 md:h-80 rounded-2xl bg-primary/20 flex items-center justify-center"
                  style={{ boxShadow: "0 0 60px 20px hsl(var(--primary) / 0.3)" }}
                >
                  <CheckCircle className="w-16 h-16 text-primary/60" />
                </motion.div>
              )}

              {/* Rabbit + message */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.6 }}
                className="flex flex-col items-center gap-2"
              >
                <RabbitCharacter state="presenting" size={60} />
                <p className="font-body text-sm text-background/80 text-center">
                  I made this for you.
                </p>
              </motion.div>

              {/* Open button — fades in after 3 seconds, heartbeat glow beckons the user */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: revealReady ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  className="inline-block rounded-2xl"
                  animate={
                    revealReady && !shouldReduceMotion
                      ? {
                          boxShadow: [
                            "0 0 0px 0px hsl(var(--primary) / 0)",
                            "0 0 20px 25px hsl(var(--primary) / 0.3)",
                            "0 0 0px 0px hsl(var(--primary) / 0)",
                            "0 0 16px 20px hsl(var(--primary) / 0.2)",
                            "0 0 0px 0px hsl(var(--primary) / 0)",
                          ],
                        }
                      : undefined
                  }
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    times: [0, 0.15, 0.35, 0.5, 0.7],
                  }}
                >
                  <Button
                    size="lg"
                    className="rounded-2xl gap-2 px-10 py-6 text-base bg-background text-foreground hover:bg-background/90 shadow-2xl"
                    onClick={dismissReveal}
                    disabled={!revealReady}
                  >
                    Open Your Book
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfettiBurst trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
    </div>
    </ChainLogProvider>
  );
};

export default WorkspaceSandbox;
