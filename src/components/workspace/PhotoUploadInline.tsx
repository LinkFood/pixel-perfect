import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) onUpload(files);
  }, [onUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const count = photos.length;

  // Random but stable rotations per photo
  const getRotation = (index: number) => {
    const seed = (index * 7 + 3) % 7;
    return (seed - 3) * 1;
  };

  return (
    <div className="space-y-3">
      {/* Upload zone */}
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        animate={isDragOver ? { scale: 1.02 } : { scale: 1 }}
        className={`rounded-[20px] border-2 border-dashed p-8 text-center cursor-pointer transition-all glass-warm ${
          isDragOver
            ? "border-primary glow-primary"
            : "border-border/60 hover:border-primary/40 hover:shadow-elevated"
        }`}
        style={isDragOver ? {
          backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--primary) / 0.15) 0, hsl(var(--primary) / 0.15) 10px, transparent 10px, transparent 20px)",
          backgroundSize: "40px 2px",
          backgroundPosition: "0 0",
          backgroundRepeat: "repeat-x",
          animation: "border-march 0.5s linear infinite",
        } : undefined}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="sr-only"
          accept="image/*"
          multiple
          onChange={e => e.target.files && onUpload(Array.from(e.target.files).filter(f => f.type.startsWith("image/")))}
        />
        <motion.div
          animate={isDragOver ? { y: -4 } : { y: 0 }}
        >
          <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragOver ? "text-primary" : "text-primary/60"}`} />
          <p className="font-body text-sm font-medium text-foreground">
            {isDragOver
              ? "Drop them here!"
              : count === 0
                ? "Drop photos to start"
                : count < 5
                  ? `${count} photo${count !== 1 ? "s" : ""} — add more?`
                  : `${count} photos — ready when you are`}
          </p>
          <p className="font-body text-xs mt-1 text-muted-foreground">
            {isUploading
              ? `Uploading... ${uploadProgress ? `${uploadProgress.completed}/${uploadProgress.total}` : ""}`
              : "Drag & drop or click to browse"}
          </p>
        </motion.div>
      </motion.div>

      {/* Photo count */}
      {count > 0 && (
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <span className="font-body text-sm font-medium text-foreground">
            <motion.span
              key={count}
              initial={{ scale: 1.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
              className="text-primary"
            >
              {count}
            </motion.span> photo{count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Photo grid */}
      {count > 0 && (
        <div className="max-h-[400px] overflow-y-auto rounded-xl">
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            <AnimatePresence>
              {photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.8, rotate: getRotation(index) * 3 }}
                  animate={{ opacity: 1, scale: 1, rotate: getRotation(index) }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: index * 0.05,
                  }}
                  whileHover={{ scale: 1.08, rotate: 0, zIndex: 10 }}
                  className="relative rounded-xl overflow-hidden group aspect-square shadow-chat cursor-pointer"
                >
                  {isUploading && index >= (photos.length - (uploadProgress?.total || 0)) && index >= (photos.length - (uploadProgress?.total || 0) + (uploadProgress?.completed || 0)) ? (
                    <div className="absolute inset-0 shimmer rounded-xl" />
                  ) : null}
                  <img
                    src={getPhotoUrl(photo.storage_path)}
                    alt={photo.caption || "Photo"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    {onToggleFavorite && (
                      <button
                        onClick={e => { e.stopPropagation(); onToggleFavorite(photo.id, photo.is_favorite); }}
                        className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                      >
                        <Star className={`w-3.5 h-3.5 ${photo.is_favorite ? "fill-yellow-500 text-yellow-500" : "text-gray-600"}`} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(photo.id, photo.storage_path); }}
                        className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
                      >
                        <X className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    )}
                  </div>
                  {photo.is_favorite && (
                    <motion.div
                      className="absolute top-1 right-1"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500 drop-shadow" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUploadInline;
