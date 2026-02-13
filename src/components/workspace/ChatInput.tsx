import { useRef } from "react";
import { motion } from "framer-motion";
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
  const hasText = value.trim().length > 0;

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files || !onPhotos) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length > 0) onPhotos(imageFiles);
  };

  return (
    <div className="px-4 md:px-0 pb-4">
      <form
        onSubmit={e => { e.preventDefault(); onSend(); }}
        className="flex items-center gap-2 rounded-[20px] px-4 py-3 glass-warm border border-border/40 shadow-elevated transition-all focus-within:glow-primary focus-within:border-primary/30"
        style={{ minHeight: 48 }}
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
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-primary/10"
              disabled={disabled}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Paperclip className="w-5 h-5" />
            </motion.button>
          </>
        )}
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none outline-none font-body text-[15px] text-foreground placeholder:text-muted-foreground"
          disabled={disabled}
        />
        <motion.button
          type="submit"
          disabled={disabled || !hasText}
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-primary text-primary-foreground disabled:opacity-30 hover:brightness-95 ${hasText ? "pulse-glow" : ""}`}
          animate={hasText ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={hasText ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
          whileTap={{ scale: 0.88, rotate: -3 }}
        >
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </form>
    </div>
  );
};

export default ChatInput;
