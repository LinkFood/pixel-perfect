import { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPhotoUrl, type ProjectPhoto } from "@/hooks/usePhotos";

interface PhotoCardProps {
  photo: ProjectPhoto;
  onUpdateCaption: (caption: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

const PhotoCard = ({ photo, onUpdateCaption, onToggleFavorite, onDelete }: PhotoCardProps) => {
  const [caption, setCaption] = useState(photo.caption || "");
  const url = getPhotoUrl(photo.storage_path);

  return (
    <div className="group rounded-2xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-square overflow-hidden">
        <img src={url} alt={photo.caption || "Pet photo"} className="w-full h-full object-cover" loading="lazy" />
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
        <Input
          placeholder="Add a memory..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => { if (caption !== (photo.caption || "")) onUpdateCaption(caption); }}
          className="border-none bg-transparent px-0 h-8 text-sm font-body placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
};

export default PhotoCard;
