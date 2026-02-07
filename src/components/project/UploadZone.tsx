import { useCallback, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading: boolean;
}

const UploadZone = ({ onFilesSelected, isUploading }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length) onFilesSelected(files);
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected(files);
    e.target.value = "";
  }, [onFilesSelected]);

  return (
    <label
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-300",
        isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-card",
        isUploading && "pointer-events-none opacity-60"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileInput} disabled={isUploading} />
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        {isUploading ? <Upload className="w-7 h-7 text-primary animate-pulse" /> : <ImagePlus className="w-7 h-7 text-primary" />}
      </div>
      <div className="text-center">
        <p className="font-display text-lg text-foreground">{isUploading ? "Uploading..." : "Drop photos here"}</p>
        <p className="font-body text-sm text-muted-foreground mt-1">or click to browse · JPG, PNG, WEBP</p>
      </div>
    </label>
  );
};

export default UploadZone;
