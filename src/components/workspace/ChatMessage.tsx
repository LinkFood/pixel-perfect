import { forwardRef } from "react";
import { motion } from "framer-motion";

interface ChatMessageProps {
  role: "rabbit" | "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  photos?: string[];
  children?: React.ReactNode;
}

const ChatMessage = forwardRef<HTMLDivElement, ChatMessageProps>(({ role, content, isStreaming, photos, children }, ref) => {
  const isRabbit = role === "rabbit" || role === "assistant";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      className={`flex ${isRabbit ? "justify-start" : "justify-end"}`}
    >
      {children ? (
        <div className="max-w-[78%]">{children}</div>
      ) : (
        <div className={`max-w-[78%] space-y-2 ${!isRabbit ? "items-end flex flex-col" : ""}`}>
          {photos && photos.length > 0 && (
            <div className={`flex gap-2 flex-wrap ${!isRabbit ? "justify-end" : ""}`}>
              {photos.map((url, i) => (
                <motion.img
                  key={i}
                  src={url}
                  alt="Photo"
                  className="w-20 h-20 rounded-2xl object-cover shadow-md"
                  initial={{ rotate: (i % 2 === 0 ? 1 : -1) * (1 + Math.random() * 2) }}
                  animate={{ rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.05 }}
                  whileHover={{ rotate: (i % 2 === 0 ? 2 : -2), scale: 1.05 }}
                />
              ))}
            </div>
          )}
          {content && (
            <div
              className={`px-4 py-3 text-[15px] leading-relaxed font-body whitespace-pre-line ${
                isRabbit
                  ? "rounded-2xl rounded-bl-md bg-[hsl(var(--chat-ai-bg))] text-[hsl(var(--chat-ai-text))] border border-[hsl(var(--chat-ai-border))] shadow-chat"
                  : "rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-chat"
              }`}
            >
              {content}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block ml-0.5"
                >
                  |
                </motion.span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});

ChatMessage.displayName = "ChatMessage";

export const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-[hsl(var(--chat-ai-bg))] border border-[hsl(var(--chat-ai-border))] rounded-2xl rounded-bl-md px-4 py-3 shadow-chat flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground/50"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  </div>
);

export default ChatMessage;
