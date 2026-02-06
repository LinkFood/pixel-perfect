import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, CheckCircle, RotateCcw, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import ChatMessage from "@/components/project/ChatMessage";
import { useProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { useInterviewMessages, useInterviewChat, useClearInterview } from "@/hooks/useInterview";
import Navbar from "@/components/landing/Navbar";

const ProjectInterview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project } = useProject(id);
  const { data: messages = [] } = useInterviewMessages(id);
  const { sendMessage, isStreaming, streamingContent } = useInterviewChat(id);
  const clearInterview = useClearInterview(id);
  const updateStatus = useUpdateProjectStatus();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const userMsgCount = messages.filter(m => m.role === "user").length;
  const canFinish = userMsgCount >= 8;
  const isComplete = userMsgCount >= 12;
  const shouldHideInput = userMsgCount >= 15;
  const progress = Math.min((userMsgCount / 12) * 100, 100);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-start interview
  useEffect(() => {
    if (messages.length === 0 && project && !isStreaming) {
      sendMessage("Hi! I'd love to start sharing about my pet.", messages, project.pet_name, project.pet_type);
    }
  }, [messages.length, project]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    if (!input.trim() || isStreaming || !project) return;
    sendMessage(input.trim(), messages, project.pet_name, project.pet_type);
    setInput("");
  };

  const handleFinish = () => {
    if (!id) return;
    updateStatus.mutate({ id, status: "generating" });
    navigate(`/project/${id}/generating`);
  };

  const handleStartFresh = () => {
    if (!confirm("This will clear all interview messages and start over. Continue?")) return;
    clearInterview.mutate();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col pt-16 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-display text-xl font-semibold text-foreground">
              Tell us about {project?.pet_name || "your pet"}
            </h1>
            <div className="flex items-center gap-2">
              {userMsgCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl gap-1 text-muted-foreground"
                  onClick={handleStartFresh}
                  disabled={isStreaming || clearInterview.isPending}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Start Fresh
                </Button>
              )}
              {canFinish && (
                <Button variant="hero" size="sm" className="rounded-xl gap-2" onClick={handleFinish}>
                  <CheckCircle className="w-4 h-4" /> Finish Interview
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs font-body text-muted-foreground whitespace-nowrap">
              {isComplete ? "Complete!" : `${userMsgCount} of ~12 questions`}
            </span>
          </div>
        </div>

        {/* Completion Banner */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-4 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3"
          >
            <PartyPopper className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                You've shared wonderful memories!
              </p>
              <p className="text-xs text-muted-foreground">
                Ready to create {project?.pet_name}'s storybook?
              </p>
            </div>
            <Button variant="hero" size="sm" className="rounded-xl gap-2 shrink-0" onClick={handleFinish}>
              <CheckCircle className="w-4 h-4" /> Create Book
            </Button>
          </motion.div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4 flex flex-col">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
          ))}
          {isStreaming && streamingContent && (
            <ChatMessage role="assistant" content={streamingContent} isStreaming />
          )}
        </div>

        {/* Input */}
        {!shouldHideInput ? (
          <div className="px-6 py-4 border-t border-border bg-background">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Share a memory..."
                className="rounded-xl flex-1"
                disabled={isStreaming}
              />
              <Button type="submit" variant="hero" size="icon" className="rounded-xl shrink-0" disabled={isStreaming || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-border bg-background text-center">
            <p className="text-sm text-muted-foreground mb-3">
              You've shared so many beautiful stories! Click below to create {project?.pet_name}'s book.
            </p>
            <Button variant="hero" className="rounded-xl gap-2" onClick={handleFinish}>
              <CheckCircle className="w-4 h-4" /> Create {project?.pet_name}'s Storybook
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectInterview;
