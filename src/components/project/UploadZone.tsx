import { useCallback, useState } from "react";
import { Upload, ImagePlus, CheckCircle, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
}

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
  uploadProgress?: UploadProgress;
}

const UploadZone = ({ onFilesSelected, isUploading, uploadProgress }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const allFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    const supported = allFiles.filter(f => SUPPORTED_TYPES.includes(f.type));
    const rejected = allFiles.length - supported.length;
    if (rejected > 0) {
      toast.error(`${rejected} photo(s) can't be used. Please use JPG, PNG, or WebP.`);
    }
    if (supported.length) onFilesSelected(supported);
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(e.target.files || []);
    const supported = allFiles.filter(f => SUPPORTED_TYPES.includes(f.type));
    const rejected = allFiles.length - supported.length;
    if (rejected > 0) {
      toast.error(`${rejected} photo(s) can't be used. Please use JPG, PNG, or WebP.`);
    }
    if (supported.length) onFilesSelected(supported);
    e.target.value = "";
  }, [onFilesSelected]);

  const done = uploadProgress ? uploadProgress.completed + uploadProgress.failed : 0;
  const percent = uploadProgress && uploadProgress.total > 0
    ? Math.round((done / uploadProgress.total) * 100)
    : 0;

  return (
    <label
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300",
        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-card",
        isUploading && "pointer-events-none"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileInput} disabled={isUploading} />

      {isUploading && uploadProgress ? (
        <>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div className="text-center w-full max-w-xs space-y-3">
            <p className="font-display text-lg text-foreground">
              Uploading {done} of {uploadProgress.total}
            </p>
            <Progress value={percent} className="h-2.5" />
            <p className="font-body text-sm text-muted-foreground">
              {uploadProgress.completed} uploaded
              {uploadProgress.failed > 0 && (
                <span className="text-destructive"> · {uploadProgress.failed} failed</span>
              )}
              {" · "}{uploadProgress.total - done} remaining
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ImagePlus className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display text-lg text-foreground">Drop photos here</p>
            <p className="font-body text-sm text-muted-foreground mt-1">or click to browse · JPG, PNG, WEBP</p>
          </div>
        </>
      )}
    </label>
  );
};

export default UploadZone;
