import { motion } from "framer-motion";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";

interface ChatMessageProps {
  role: "rabbit" | "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  rabbitState?: RabbitState;
  photos?: string[];
  children?: React.ReactNode;
}

const ChatMessage = ({ role, content, isStreaming, photos, children }: ChatMessageProps) => {
  const isRabbit = role === "rabbit" || role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isRabbit ? "items-start gap-3" : "justify-end"}`}
    >
      {isRabbit && (
        <div className="shrink-0 mt-1">
          <RabbitCharacter state="idle" size={32} />
        </div>
      )}

      {children ? (
        <div className="max-w-[85%]">{children}</div>
      ) : (
        <div className="max-w-[80%] space-y-2">
          {photos && photos.length > 0 && (
            <div className={`flex gap-2 flex-wrap ${!isRabbit ? "justify-end" : ""}`}>
              {photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Photo"
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ))}
            </div>
          )}
          {content && (
            <div
              className={`rounded-2xl px-4 py-3 ${
                isRabbit ? "rounded-tl-md" : "rounded-tr-md ml-auto"
              }`}
              style={{
                background: isRabbit ? "#F5EDE4" : "#E8D5C0",
                border: isRabbit ? "1px solid #E8D5C0" : "none",
              }}
            >
              <p
                className="font-body text-[15px] leading-relaxed whitespace-pre-line"
                style={{ color: "#2C2417" }}
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
