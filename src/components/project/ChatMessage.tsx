import { cn } from "@/lib/utils";
import { PawPrint, User } from "lucide-react";

interface ChatMessageProps {
  role: string;
  content: string;
  isStreaming?: boolean;
}

const ChatMessage = ({ role, content, isStreaming }: ChatMessageProps) => {
  const isAssistant = role === "assistant";

  return (
    <div className={cn("flex gap-3 max-w-[85%]", isAssistant ? "self-start" : "self-end flex-row-reverse")}>
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1",
        isAssistant ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"
      )}>
        {isAssistant ? <PawPrint className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-3 font-body text-sm leading-relaxed",
        isAssistant ? "bg-card border border-border text-card-foreground" : "bg-primary text-primary-foreground",
        isStreaming && "animate-pulse"
      )}>
        {content}
      </div>
    </div>
  );
};

export default ChatMessage;
