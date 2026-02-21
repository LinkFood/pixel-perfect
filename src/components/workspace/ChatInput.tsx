import { useRef, useEffect, useCallback, forwardRef } from "react";
import { motion } from "framer-motion";
import { Paperclip, PawPrint } from "lucide-react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onPhotos?: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showPhotoButton?: boolean;
}

const MAX_ROWS = 4;
const LINE_HEIGHT = 22; // px per line of text
const BASE_HEIGHT = LINE_HEIGHT; // start at 1 line

const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(({
  value,
  onChange,
  onSend,
  onPhotos,
  disabled = false,
  placeholder = "Tell Rabbit what you're making...",
  showPhotoButton = true,
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSendingRef = useRef(false);
  const hasText = value.trim().length > 0;

  // Auto-resize textarea to content, max 4 lines
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = `${BASE_HEIGHT}px`;
    const maxHeight = LINE_HEIGHT * MAX_ROWS;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handlePhotoSelect = (files: FileList | null) => {
    if (!files || !onPhotos) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (imageFiles.length > 0) onPhotos(imageFiles);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits, Shift+Enter inserts newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSendingRef.current && hasText && !disabled) {
        isSendingRef.current = true;
        Promise.resolve(onSend()).finally(() => { isSendingRef.current = false; });
      }
    }
  };

  return (
    <div ref={ref} className="px-4 pb-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (isSendingRef.current) return;
          isSendingRef.current = true;
          try { await onSend(); } finally { isSendingRef.current = false; }
        }}
        className="flex items-end gap-2 rounded-[20px] px-4 py-3 glass-warm border border-border/40 shadow-elevated transition-all focus-within:glow-primary focus-within:border-primary/30"
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
              onChange={e => { handlePhotoSelect(e.target.files); e.target.value = ""; }}
            />
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 p-1.5 rounded-lg transition-colors text-muted-foreground hover:text-foreground hover:bg-primary/10 mb-0.5"
              disabled={disabled}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Paperclip className="w-5 h-5" />
            </motion.button>
          </>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Type a message"
          className="flex-1 bg-transparent border-none outline-none font-body text-[15px] text-foreground placeholder:text-muted-foreground resize-none overflow-y-auto leading-[22px]"
          style={{ height: BASE_HEIGHT, maxHeight: LINE_HEIGHT * MAX_ROWS }}
          disabled={disabled}
          rows={1}
        />
        <motion.button
          type="submit"
          disabled={disabled || !hasText}
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-primary text-primary-foreground disabled:opacity-30 hover:brightness-95 mb-0.5 ${hasText ? "pulse-glow" : ""}`}
          animate={hasText ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={hasText ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
          whileTap={{ scale: 0.85, rotate: -8, transition: { type: "spring", stiffness: 500, damping: 15 } }}
        >
          <PawPrint className="w-4 h-4" />
        </motion.button>
      </form>
    </div>
  );
});

ChatInput.displayName = "ChatInput";

export default ChatInput;
