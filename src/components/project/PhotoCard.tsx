import { useState } from "react";
import { Star, Trash2, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getPhotoUrl, type ProjectPhoto } from "@/hooks/usePhotos";

interface PhotoCardProps {
  photo: ProjectPhoto;
  isCaptioning?: boolean;
  onUpdateCaption: (caption: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

const PhotoCard = ({ photo, isCaptioning, onUpdateCaption, onToggleFavorite, onDelete }: PhotoCardProps) => {
  const [caption, setCaption] = useState(photo.caption || "");
  const url = getPhotoUrl(photo.storage_path);

  // Sync caption from prop when AI captioning completes
  const displayCaption = isCaptioning ? "" : (photo.caption || caption);
  if (!isCaptioning && photo.caption && caption !== photo.caption) {
    setCaption(photo.caption);
  }

  const analysis = photo.ai_analysis as Record<string, unknown> | null;
  const mood = analysis?.mood as string | undefined;
  const setting = analysis?.setting as string | undefined;
  const hasTags = !isCaptioning && (mood || setting);

  return (
    <div className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-square overflow-hidden">
        <img src={url} alt={photo.caption || "Photo"} className="w-full h-full object-cover" loading="lazy" />
        {isCaptioning && (
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center">
            <div className="flex items-center gap-2 bg-background/90 rounded-full px-3 py-1.5 border border-border">
              <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="text-xs font-body text-muted-foreground">AI analyzing...</span>
            </div>
          </div>
        )}
        {hasTags && (
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1">
            {mood && (
              <span className="inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-body text-foreground">
                <Sparkles className="w-2.5 h-2.5 text-primary" /> {mood}
              </span>
            )}
            {setting && (
              <span className="inline-flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-body text-foreground">
                <MapPin className="w-2.5 h-2.5 text-primary" /> {setting}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm", photo.is_favorite && "text-accent")}
            onClick={onToggleFavorite}
          >
            <Star className={cn("w-4 h-4", photo.is_favorite && "fill-current")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="p-3">
        {isCaptioning ? (
          <Skeleton className="h-4 w-3/4" />
        ) : (
          <Input
            placeholder="Add a memory..."
            value={displayCaption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => { if (caption !== (photo.caption || "")) onUpdateCaption(caption); }}
            className="border-none bg-transparent px-0 h-8 text-sm font-body placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        )}
      </div>
    </div>
  );
};

export default PhotoCard;
