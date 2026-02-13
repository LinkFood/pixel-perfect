import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Camera, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter from "@/components/rabbit/RabbitCharacter";
import PhotoUploadInline from "./PhotoUploadInline";
import MoodPicker from "./MoodPicker";
import GenerationView from "./GenerationView";
import BookReview from "@/components/project/BookReview";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { type ProjectPhoto, getPhotoUrl } from "@/hooks/usePhotos";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useRef } from "react";

type Phase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

interface WorkspaceSandboxProps {
  phase: Phase;
  // Photo props
  photos: ProjectPhoto[];
  isBatchUploading: boolean;
  uploadProgress?: { total: number; completed: number; failed: number };
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
  onFinishInterview: () => void;
  // Generation props
  activeProjectId: string | null;
  onGenerationComplete: () => void;
  onNewIllustration?: (pageNum: number, url: string) => void;
  interviewHighlights?: string[];
  // Review props
  onBackFromReview: () => void;
}

const WorkspaceSandbox = ({
  phase,
  photos,
  isBatchUploading,
  uploadProgress,
  onPhotoUpload,
  onToggleFavorite,
  onDeletePhoto,
  canContinueToInterview,
  onContinueToInterview,
  petName,
  onMoodSelect,
  canFinish,
  onFinishInterview,
  activeProjectId,
  onGenerationComplete,
  onNewIllustration,
  interviewHighlights,
  onBackFromReview,
}: WorkspaceSandboxProps) => {
  const [photoStripOpen, setPhotoStripOpen] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [revealReady, setRevealReady] = useState(false);
  const [coverIllustrationUrl, setCoverIllustrationUrl] = useState<string | null>(null);
  const prevPhaseRef = useRef<Phase>(phase);

  // Fetch cover illustration URL when transitioning to review
  useEffect(() => {
    if (phase === "review" && prevPhaseRef.current === "generating" && activeProjectId) {
      setShowReveal(true);
      setRevealReady(false);

      // Fetch cover illustration
      const fetchCover = async () => {
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
        // Button becomes clickable after 3 seconds
        setTimeout(() => setRevealReady(true), 3000);
      };
      fetchCover();
    }
    prevPhaseRef.current = phase;
  }, [phase, activeProjectId]);

  const dismissReveal = () => {
    setShowReveal(false);
    setCoverIllustrationUrl(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
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
                  : photos.length < 5
                    ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} — add more?`
                    : `${photos.length} photos — looking great!`}
              </h2>
              <p className="font-body text-sm text-muted-foreground">
                Pets, kids, trips, couples — anything with a story
              </p>
            </div>

            <PhotoUploadInline
              photos={photos}
              isUploading={isBatchUploading}
              uploadProgress={isBatchUploading ? uploadProgress : undefined}
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
                  That's all my photos — let's go!
                </Button>
                <p className="font-body text-xs mt-2 text-muted-foreground">Or keep adding more photos</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Mood picker phase */}
        {phase === "mood-picker" && (
          <motion.div
            key="mood"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <MoodPicker petName={petName} onSelect={onMoodSelect} />
          </motion.div>
        )}

        {/* Interview phase — photo strip + finish button */}
        {phase === "interview" && (
          <motion.div
            key="interview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col p-6 gap-4"
          >
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-foreground">Tell Me About Them</h2>
              <p className="font-body text-sm text-muted-foreground">
                Chat with Rabbit in the left panel — share memories, stories, personality
              </p>
            </div>

            {/* Photo strip */}
            {photos.length > 0 && (
              <Collapsible open={photoStripOpen} onOpenChange={setPhotoStripOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 group cursor-pointer">
                  <div className="flex -space-x-2">
                    {photos.slice(0, 6).map((p) => (
                      <div key={p.id} className="w-8 h-8 rounded-full overflow-hidden border-2 border-primary/20 shrink-0" style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.1)" }}>
                        <img src={getPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <span className="font-body text-xs flex items-center gap-1 text-muted-foreground">
                    <Camera className="w-3 h-3" />
                    {photos.length} photo{photos.length !== 1 ? "s" : ""}
                  </span>
                  <ChevronDown
                    className="w-3.5 h-3.5 ml-auto transition-transform duration-200 text-muted-foreground"
                    style={{ transform: photoStripOpen ? "rotate(180deg)" : undefined }}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide">
                    {photos.map((p) => (
                      <div key={p.id} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border">
                        <img src={getPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex-1" />

            {!canFinish && (
              <p className="font-body text-xs text-muted-foreground text-center py-2 italic">
                The more you share, the better your book will be.
              </p>
            )}

            {canFinish && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-4"
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0 0 hsl(var(--primary) / 0.3)",
                      "0 0 20px 8px hsl(var(--primary) / 0.15)",
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
                  >
                    <CheckCircle className="w-5 h-5" /> Make my book!
                  </Button>
                </motion.div>
                <p className="font-body text-xs mt-2 text-muted-foreground">
                  You can always come back and add more
                </p>
              </motion.div>
            )}
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
              className="absolute inset-0 bg-amber-950/90"
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
                className="font-display text-3xl md:text-4xl font-bold text-white text-center drop-shadow-lg"
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
                <p className="font-body text-sm text-white/80 text-center">
                  I made this for you.
                </p>
              </motion.div>

              {/* Open button — fades in after 3 seconds */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: revealReady ? 1 : 0 }}
                transition={{ duration: 0.5 }}
              >
                <Button
                  size="lg"
                  className="rounded-2xl gap-2 px-10 py-6 text-base bg-white text-amber-950 hover:bg-white/90 shadow-2xl"
                  onClick={dismissReveal}
                  disabled={!revealReady}
                >
                  Open Your Book
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceSandbox;
