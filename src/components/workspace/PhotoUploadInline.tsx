import { useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, X, Star } from "lucide-react";
import { type ProjectPhoto, getPhotoUrl } from "@/hooks/usePhotos";

interface PhotoUploadInlineProps {
  photos: ProjectPhoto[];
  isUploading: boolean;
  uploadProgress?: { total: number; completed: number; failed: number };
  onUpload: (files: File[]) => void;
  onToggleFavorite?: (photoId: string, current: boolean) => void;
  onDelete?: (photoId: string, storagePath: string) => void;
}

const PhotoUploadInline = ({
  photos,
  isUploading,
  uploadProgress,
  onUpload,
  onToggleFavorite,
  onDelete,
}: PhotoUploadInlineProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) onUpload(files);
  }, [onUpload]);

  const count = photos.length;
  const threshold = count === 0 ? "zero" : count < 5 ? "low" : count < 20 ? "good" : "excellent";
  const messages: Record<string, string> = {
    zero: "Drop photos here or tap to browse",
    low: "A few more will help tell a richer story",
    good: "Great collection! More photos = more memories",
    excellent: "Plenty to work with!",
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors hover:border-[#C4956A]/50"
        style={{ borderColor: "#E8D5C0", background: "#FEFCF9" }}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="sr-only"
          accept="image/*"
          multiple
          onChange={e => e.target.files && onUpload(Array.from(e.target.files).filter(f => f.type.startsWith("image/")))}
        />
        <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: "#C4956A" }} />
        <p className="font-body text-sm" style={{ color: "#6B5D4F" }}>
          {isUploading
            ? `Uploading... ${uploadProgress ? `${uploadProgress.completed}/${uploadProgress.total}` : ""}`
            : messages[threshold]}
        </p>
      </div>

      {/* Photo count */}
      {count > 0 && (
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4" style={{ color: "#C4956A" }} />
          <span className="font-body text-sm font-medium" style={{ color: "#2C2417" }}>
            {count} photo{count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Photo grid */}
      {count > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.slice(0, 12).map(photo => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-xl overflow-hidden group aspect-square"
            >
              <img
                src={getPhotoUrl(photo.storage_path)}
                alt={photo.caption || "Photo"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* Hover actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {onToggleFavorite && (
                  <button
                    onClick={e => { e.stopPropagation(); onToggleFavorite(photo.id, photo.is_favorite); }}
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
                  >
                    <Star className={`w-3 h-3 ${photo.is_favorite ? "fill-yellow-500 text-yellow-500" : "text-gray-600"}`} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(photo.id, photo.storage_path); }}
                    className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                )}
              </div>
              {/* Favorite indicator */}
              {photo.is_favorite && (
                <div className="absolute top-1 right-1">
                  <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 drop-shadow" />
                </div>
              )}
            </motion.div>
          ))}
          {count > 12 && (
            <div
              className="rounded-xl flex items-center justify-center aspect-square"
              style={{ background: "#F5EDE4" }}
            >
              <span className="font-body text-sm font-medium" style={{ color: "#6B5D4F" }}>
                +{count - 12}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PhotoUploadInline;
