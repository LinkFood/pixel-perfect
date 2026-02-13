import { motion } from "framer-motion";

interface ChatMessageProps {
  role: "rabbit" | "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  photos?: string[];
  children?: React.ReactNode;
}

const ChatMessage = ({ role, content, isStreaming, photos, children }: ChatMessageProps) => {
  const isRabbit = role === "rabbit" || role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className={`flex ${isRabbit ? "items-start" : "justify-end"}`}
    >
      {children ? (
        <div className="max-w-[85%]">{children}</div>
      ) : (
        <div className="max-w-[80%] space-y-2">
          {photos && photos.length > 0 && (
            <div className={`flex gap-2 flex-wrap ${!isRabbit ? "justify-end" : ""}`}>
              {photos.map((url, i) => (
                <motion.img
                  key={i}
                  src={url}
                  alt="Photo"
                  className="w-20 h-20 rounded-xl object-cover shadow-elevated"
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
              className={`rounded-2xl px-5 py-3.5 ${
                isRabbit
                  ? "rounded-tl-md glass-warm glow-soft border-l-2 border-l-primary/30"
                  : "rounded-tr-md ml-auto shadow-elevated hover:shadow-float transition-shadow"
              }`}
              style={
                isRabbit
                  ? undefined
                  : {
                      background: "hsl(var(--chat-user-bg))",
                    }
              }
            >
              <p
                className="font-body text-[15px] leading-relaxed whitespace-pre-line"
                style={{
                  color: isRabbit
                    ? "hsl(var(--chat-ai-text))"
                    : "hsl(var(--chat-user-text))",
                }}
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
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ChatMessage;
