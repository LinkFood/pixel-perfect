import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, ArrowRight, ImagePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import UploadZone from "@/components/project/UploadZone";
import PhotoGrid from "@/components/project/PhotoGrid";
import { useCreateMinimalProject } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto } from "@/hooks/usePhotos";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";

const thresholdMessages: Record<string, { text: string; color: string }> = {
  zero: { text: "Upload at least 5 photos to continue", color: "text-muted-foreground" },
  low: { text: "A few more photos will help tell a richer story", color: "text-accent" },
  good: { text: "Great collection! More photos = more memories to weave in", color: "text-primary" },
  excellent: { text: "Amazing! Plenty of material to work with", color: "text-primary" },
};

const STORAGE_KEY = "photorabbit_new_project_id";

const ProjectNew = () => {
  const navigate = useNavigate();
  const createProject = useCreateMinimalProject();
  const [projectId, setProjectId] = useState<string | null>(() => {
    return sessionStorage.getItem(STORAGE_KEY);
  });
  const creatingRef = useRef(false);

  const { data: photos = [] } = usePhotos(projectId ?? undefined);
  const { captioningIds, uploadBatch, uploadProgress, isBatchUploading } = useUploadPhoto();
  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const count = photos.length;
  const analyzedCount = photos.filter(p => p.caption || p.ai_analysis).length;
  const isAnalyzingPhotos = captioningIds.size > 0;
  const analysisPercent = count > 0 ? Math.round((analyzedCount / count) * 100) : 0;
  const threshold = count === 0 ? "zero" : count < 5 ? "low" : count < 20 ? "good" : "excellent";
  const msg = thresholdMessages[threshold];
  const canContinue = count >= 5 && analyzedCount >= 5 && !isBatchUploading;

  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (projectId) return projectId;
    if (creatingRef.current) return null;
    creatingRef.current = true;
    try {
      const project = await createProject.mutateAsync();
      setProjectId(project.id);
      sessionStorage.setItem(STORAGE_KEY, project.id);
      return project.id;
    } catch {
      creatingRef.current = false;
      return null;
    }
  }, [projectId, createProject]);

  const handleUpload = async (files: File[]) => {
    const id = await ensureProject();
    if (!id) return;
    uploadBatch(id, files);
  };

  const handleContinue = () => {
    if (!projectId) return;
    // Clear session storage — this project is moving forward
    sessionStorage.removeItem(STORAGE_KEY);
    // Fire appearance profile build in background
    supabase.functions.invoke("build-appearance-profile", {
      body: { projectId },
    }).then(({ error }) => {
      if (error) console.error("Appearance profile build failed:", error);
      else console.log("Appearance profile built successfully");
    });
    navigate(`/project/${projectId}/context`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <ImagePlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Drop your photos — we'll take it from here
            </h1>
            <p className="font-body text-muted-foreground mt-2">
              Our AI reads every detail so your creation feels genuinely personal
            </p>
          </div>

          <div className="space-y-6">
            <UploadZone
              onFilesSelected={handleUpload}
              isUploading={isBatchUploading}
              uploadProgress={isBatchUploading ? uploadProgress : undefined}
            />

            {count > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2 border border-border">
                      <Camera className="w-4 h-4 text-primary" />
                      <span className="font-body text-sm font-medium text-foreground">{count}</span>
                    </div>
                    <p className={`font-body text-sm ${msg.color}`}>{msg.text}</p>
                  </div>
                  <Button
                    variant="hero"
                    className="rounded-xl gap-2"
                    disabled={!canContinue}
                    onClick={handleContinue}
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

                {(isAnalyzingPhotos || (analyzedCount > 0 && analyzedCount < count)) && (
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse shrink-0" />
                    <Progress value={analysisPercent} className="h-1.5 flex-1" />
                    <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
                      {analyzedCount}/{count} analyzed
                    </span>
                  </div>
                )}
              </div>
            )}

            {projectId && (
              <PhotoGrid
                photos={photos}
                captioningIds={captioningIds}
                onUpdateCaption={(photoId, caption) => updatePhoto.mutate({ id: photoId, projectId, caption })}
                onToggleFavorite={(photoId, current) => updatePhoto.mutate({ id: photoId, projectId, is_favorite: !current })}
                onDelete={(photoId, storagePath) => deletePhoto.mutate({ id: photoId, projectId, storagePath })}
              />
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectNew;
