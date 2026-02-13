import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Camera, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import PhotoUploadInline from "./PhotoUploadInline";
import MoodPicker from "./MoodPicker";
import GenerationView from "./GenerationView";
import BookReview from "@/components/project/BookReview";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { type ProjectPhoto, getPhotoUrl } from "@/hooks/usePhotos";
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
  onBackFromReview,
}: WorkspaceSandboxProps) => {
  const [photoStripOpen, setPhotoStripOpen] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const prevPhaseRef = useRef<Phase>(phase);

  // Book reveal sequence: when transitioning to review
  useEffect(() => {
    if (phase === "review" && prevPhaseRef.current === "generating") {
      setShowReveal(true);
      const timer = setTimeout(() => setShowReveal(false), 2200);
      return () => clearTimeout(timer);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

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
            />
          </motion.div>
        )}

        {/* Review phase — with reveal sequence */}
        {phase === "review" && activeProjectId && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {showReveal ? (
              <motion.div
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
                  className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center glow-primary"
                >
                  <CheckCircle className="w-10 h-10 text-primary" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="font-display text-2xl font-bold text-foreground text-center"
                >
                  {petName}'s Book is Ready
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="font-body text-sm text-muted-foreground text-center"
                >
                  Every page illustrated, every memory captured
                </motion.p>
              </motion.div>
            ) : (
              <BookReview projectId={activeProjectId} onBack={onBackFromReview} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceSandbox;
