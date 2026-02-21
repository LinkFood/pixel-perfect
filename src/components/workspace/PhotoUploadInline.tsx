import { useCallback, useRef, useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Upload, X, Star, Sparkles } from "lucide-react";
import { type ProjectPhoto, getPhotoUrl } from "@/hooks/usePhotos";

const PhotoThumb = forwardRef<HTMLDivElement, { storagePath: string; alt: string }>(({ storagePath, alt }, ref) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div ref={ref} className="absolute inset-0">
      {!loaded && <div className="absolute inset-0 animate-pulse rounded-xl bg-muted" />}
      <img
        src={getPhotoUrl(storagePath)}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </div>
  );
});
PhotoThumb.displayName = "PhotoThumb";

interface PhotoUploadInlineProps {
  photos: ProjectPhoto[];
  isUploading: boolean;
  uploadProgress?: { total: number; completed: number; failed: number };
  captioningIds?: Set<string>;
  onUpload: (files: File[]) => void;
  onToggleFavorite?: (photoId: string, current: boolean) => void;
  onDelete?: (photoId: string, storagePath: string) => void;
}

const PhotoUploadInline = ({
  photos,
  isUploading,
  uploadProgress,
  captioningIds,
  onUpload,
  onToggleFavorite,
  onDelete,
}: PhotoUploadInlineProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [gridPage, setGridPage] = useState(0);

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
    const seed = (index * 13 + 5) % 7;
    return (seed - 3) * 1.2;
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
          onChange={e => {
            if (e.target.files) {
              onUpload(Array.from(e.target.files).filter(f => f.type.startsWith("image/")));
              e.target.value = "";
            }
          }}
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
          {isUploading && uploadProgress && uploadProgress.total > 0 && (
            <div className="w-full max-w-[200px] mx-auto mt-2 h-1.5 rounded-full bg-border/40 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          )}
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
      {count > 0 && (() => {
        const PAGE_SIZE = 12;
        const totalPages = Math.ceil(count / PAGE_SIZE);
        const visiblePhotos = photos.slice(gridPage * PAGE_SIZE, (gridPage + 1) * PAGE_SIZE);
        return (
        <div className="rounded-xl">
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            <AnimatePresence>
              {visiblePhotos.map((photo, index) => {
                const isCaptioning = captioningIds?.has(photo.id) || false;
                return (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.8, rotate: getRotation(index) * 3 }}
                  animate={{ opacity: 1, scale: 1, rotate: getRotation(index) }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: Math.min(index * 0.05, 0.5),
                  }}
                  whileHover={{ scale: 1.08, rotate: 0, zIndex: 10 }}
                  className="relative rounded-xl overflow-hidden group aspect-square shadow-chat cursor-pointer"
                >
                  <PhotoThumb storagePath={photo.storage_path} alt={photo.caption || "Photo"} />
                  {isCaptioning && (
                    <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="flex items-center gap-1.5 bg-background/90 rounded-full px-2 py-1 border border-border">
                        <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                        <span className="text-[10px] font-body text-muted-foreground">Studying...</span>
                      </div>
                    </div>
                  )}
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
                );
              })}
            </AnimatePresence>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setGridPage(i)}
                  className={`w-2 h-2 rounded-full transition-all ${gridPage === i ? "bg-primary scale-125" : "bg-border hover:bg-muted-foreground/40"}`}
                />
              ))}
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
};

export default PhotoUploadInline;
