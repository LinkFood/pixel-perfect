import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ArrowRight, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import UploadZone from "@/components/project/UploadZone";
import PhotoGrid from "@/components/project/PhotoGrid";
import { useProject } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto } from "@/hooks/usePhotos";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";

const thresholdMessages: Record<string, { text: string; color: string }> = {
  zero: { text: "Upload at least 5 photos to continue", color: "text-muted-foreground" },
  low: { text: "A few more photos will help tell a richer story", color: "text-accent" },
  good: { text: "Great collection! More photos = more memories to weave in", color: "text-primary" },
  excellent: { text: "Amazing! Plenty of material for a beautiful book", color: "text-primary" },
};

const ProjectUpload = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const { data: photos = [] } = usePhotos(id);
  const { captioningIds, uploadBatch, uploadProgress, isBatchUploading, ...uploadPhoto } = useUploadPhoto();
  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const count = photos.length;
  const threshold = count === 0 ? "zero" : count < 5 ? "low" : count < 20 ? "good" : "excellent";
  const msg = thresholdMessages[threshold];

  const handleUpload = (files: File[]) => {
    if (!id) return;
    uploadBatch(id, files);
  };

  const handleContinue = () => {
    if (!id) return;
    // Fire appearance profile build in background (don't await)
    supabase.functions.invoke("build-appearance-profile", {
      body: { projectId: id },
    }).then(({ error }) => {
      if (error) console.error("Appearance profile build failed:", error);
      else console.log("Appearance profile built successfully");
    });
    // Navigate to context page
    navigate(`/project/${id}/context`);
  };

  const uploadPercent = uploadProgress.total > 0
    ? Math.round(((uploadProgress.completed + uploadProgress.failed) / uploadProgress.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 container mx-auto px-6 lg:px-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-end justify-between mb-8">
            <div>
              <Link to={`/project/${id}/context`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 font-body transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </Link>
              <h1 className="font-display text-3xl font-bold text-foreground">
                {project ? `${project.pet_name}'s Photos` : "Upload Photos"}
              </h1>
              <p className="font-body text-muted-foreground mt-1">Share your favorite memories</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-card rounded-full px-4 py-2 border border-border">
                <Camera className="w-4 h-4 text-primary" />
                <span className="font-body text-sm font-medium text-foreground">{count}</span>
              </div>
              <Button
                variant="hero"
                className="rounded-xl gap-2"
                disabled={count < 5 || isBatchUploading}
                onClick={handleContinue}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <p className={`font-body text-sm mb-6 ${msg.color}`}>{msg.text}</p>

          <div className="space-y-8">
            <UploadZone
              onFilesSelected={handleUpload}
              isUploading={isBatchUploading}
              uploadProgress={isBatchUploading ? uploadProgress : undefined}
            />

            <PhotoGrid
              photos={photos}
              captioningIds={captioningIds}
              onUpdateCaption={(photoId, caption) => id && updatePhoto.mutate({ id: photoId, projectId: id, caption })}
              onToggleFavorite={(photoId, current) => id && updatePhoto.mutate({ id: photoId, projectId: id, is_favorite: !current })}
              onDelete={(photoId, storagePath) => id && deletePhoto.mutate({ id: photoId, projectId: id, storagePath })}
            />
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ProjectUpload;
