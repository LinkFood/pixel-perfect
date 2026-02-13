import { useRef } from "react";
import { Paperclip, ArrowRight } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onPhotos?: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showPhotoButton?: boolean;
}

const ChatInput = ({
  value,
  onChange,
  onSend,
  onPhotos,
  disabled = false,
  placeholder = "Tell Rabbit what you're making...",
  showPhotoButton = true,
}: ChatInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files || !onPhotos) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length > 0) onPhotos(imageFiles);
  };

  return (
    <div className="px-4 md:px-0 pb-4">
      <form
        onSubmit={e => { e.preventDefault(); onSend(); }}
        className="flex items-center gap-2 rounded-[20px] px-4 py-2.5 bg-card border border-border/60 shadow-input transition-all focus-within:border-primary/30 focus-within:shadow-md"
      >
        {showPhotoButton && onPhotos && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept="image/*"
              multiple
              onChange={e => handlePhotoSelect(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-primary/10"
              disabled={disabled}
            >
              <Paperclip className="w-5 h-5" />
            </button>
          </>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none font-body text-[15px] text-foreground placeholder:text-muted-foreground"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-primary text-primary-foreground disabled:opacity-30 hover:brightness-95 hover:shadow-sm active:scale-95"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
