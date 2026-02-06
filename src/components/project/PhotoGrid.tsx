import PhotoCard from "./PhotoCard";
import { type ProjectPhoto } from "@/hooks/usePhotos";

interface PhotoGridProps {
  photos: ProjectPhoto[];
  onUpdateCaption: (id: string, caption: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onDelete: (id: string, storagePath: string) => void;
}

const PhotoGrid = ({ photos, onUpdateCaption, onToggleFavorite, onDelete }: PhotoGridProps) => {
  if (photos.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {photos.map((photo) => (
        <PhotoCard
          key={photo.id}
          photo={photo}
          onUpdateCaption={(caption) => onUpdateCaption(photo.id, caption)}
          onToggleFavorite={() => onToggleFavorite(photo.id, photo.is_favorite)}
          onDelete={() => onDelete(photo.id, photo.storage_path)}
        />
      ))}
    </div>
  );
};

export default PhotoGrid;
