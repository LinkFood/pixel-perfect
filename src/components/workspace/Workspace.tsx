import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import PhotoUploadInline from "./PhotoUploadInline";
import ProjectShelf from "./ProjectShelf";
import GenerationView from "./GenerationView";
import MinimalNav from "./MinimalNav";
import { useProject, useProjects, useCreateMinimalProject, useUpdateProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto } from "@/hooks/usePhotos";
import { useInterviewMessages, useInterviewChat } from "@/hooks/useInterview";
import { supabase } from "@/integrations/supabase/client";

type WorkspaceView = "home" | "upload" | "interview" | "generating" | "review";

interface WorkspaceProps {
  projectId?: string;
}

const Workspace = ({ projectId: propProjectId }: WorkspaceProps) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const resolvedId = propProjectId || paramId;

  const { data: projects = [] } = useProjects();
  const { data: project } = useProject(resolvedId);
  const { data: photos = [] } = usePhotos(resolvedId);
  const { data: interviewMessages = [] } = useInterviewMessages(resolvedId);
  const { sendMessage, isStreaming, streamingContent } = useInterviewChat(resolvedId);
  const createProject = useCreateMinimalProject();
  const updateProject = useUpdateProject();
  const updateStatus = useUpdateProjectStatus();
  const { uploadBatch, captioningIds, uploadProgress, isBatchUploading } = useUploadPhoto();
  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const [input, setInput] = useState("");
  const [rabbitState, setRabbitState] = useState<RabbitState>("idle");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[] }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(resolvedId || null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Derive view from project status
  const view: WorkspaceView = !activeProjectId || !project
    ? "home"
    : project.status === "upload" ? "upload"
    : project.status === "interview" ? "interview"
    : project.status === "generating" ? "generating"
    : project.status === "review" ? "review"
    : "home";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  // Initialize with greeting
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!resolvedId) {
      setRabbitState("idle");
      if (projects.length > 0) {
        setChatMessages([{
          role: "rabbit",
          content: `Welcome back! Pick up where you left off, or start something new.`,
        }]);
      } else {
        setChatMessages([{
          role: "rabbit",
          content: `Hey! I'm Rabbit. Drop some photos and tell me what you want to make — a book, a card, anything.`,
        }]);
      }
    }
  }, [resolvedId, projects.length]);

  // Update rabbit state based on view
  useEffect(() => {
    if (view === "generating") setRabbitState("painting");
    else if (view === "interview") setRabbitState("listening");
    else if (view === "upload" && photos.length > 0) setRabbitState("excited");
    else if (view === "review") setRabbitState("presenting");
    else setRabbitState("idle");
  }, [view, photos.length]);

  const handleNewProject = async () => {
    try {
      const project = await createProject.mutateAsync();
      setActiveProjectId(project.id);
      navigate(`/project/${project.id}`);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "Great! Drop some photos of whoever this is about — the more the better.",
      }]);
      setShowPhotoUpload(true);
      setRabbitState("excited");
    } catch {
      // handled by mutation
    }
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    navigate(`/project/${id}`);
  };

  const handlePhotoUpload = (files: File[]) => {
    if (!activeProjectId) return;
    uploadBatch(activeProjectId, files);
    setRabbitState("excited");
    if (files.length > 3) {
      setChatMessages(prev => [...prev, { role: "rabbit", content: "Ooh, lots of photos! I'm going to study every one." }]);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setChatMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    scrollToBottom();

    if (view === "interview" && project) {
      // Wire to real interview
      const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
      sendMessage(text, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type);
      setRabbitState("thinking");
    } else if (view === "home" && !activeProjectId) {
      // Pre-project: create and start
      handleNewProject();
    } else if (view === "upload") {
      // During upload, treat as a note
      setChatMessages(prev => [...prev, { role: "rabbit", content: "Got it! Keep dropping photos when you're ready." }]);
    }
  };

  // Show streaming interview responses as chat messages
  useEffect(() => {
    if (!isStreaming && streamingContent) {
      setChatMessages(prev => [...prev, { role: "rabbit", content: streamingContent }]);
      setRabbitState("listening");
      scrollToBottom();
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show interview messages from DB (on reload/resume)
  useEffect(() => {
    if (view !== "interview" || interviewMessages.length === 0) return;
    // Only populate if our local chat is empty for this view
    if (chatMessages.some(m => m.role === "user")) return;
    const restored = interviewMessages.map(m => ({
      role: (m.role === "assistant" ? "rabbit" : "user") as "rabbit" | "user",
      content: m.content,
    }));
    setChatMessages(restored);
  }, [view, interviewMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinueToInterview = () => {
    if (!activeProjectId) return;
    // Fire appearance profile in background
    supabase.functions.invoke("build-appearance-profile", {
      body: { projectId: activeProjectId },
    });
    updateStatus.mutate({ id: activeProjectId, status: "interview" });
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `Beautiful photos! Now let me ask you some questions so I can write the story. Tell me about ${project?.pet_name || "them"}...`,
    }]);
    setRabbitState("listening");
    scrollToBottom();
  };

  const handleFinishInterview = () => {
    if (!activeProjectId) return;
    updateStatus.mutate({ id: activeProjectId, status: "generating" });
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `I have everything I need. Watch this — I'm going to paint ${project?.pet_name || "their"}'s book!`,
    }]);
  };

  const handleGenerationComplete = () => {
    setRabbitState("presenting");
    scrollToBottom();
  };

  const userInterviewCount = interviewMessages.filter(m => m.role === "user").length;
  const canFinish = userInterviewCount >= 8;
  const canContinueToInterview = photos.length >= 5 && !isBatchUploading;

  // ─── Render ───────────────────────────────────────────────
  if (view === "generating") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
        <MinimalNav />
        <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto">
          <GenerationView
            projectId={activeProjectId!}
            petName={project?.pet_name || "your pet"}
            onComplete={handleGenerationComplete}
          />
        </div>
        <ProjectShelf
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={handleSelectProject}
          onNew={handleNewProject}
        />
      </div>
    );
  }

  if (view === "review") {
    // For review, navigate to the full review page (too complex for inline)
    navigate(`/project/${activeProjectId}/review`);
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
      <MinimalNav />

      <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto overflow-hidden">
        {/* Rabbit */}
        <div className="flex justify-center py-4 shrink-0">
          <RabbitCharacter state={rabbitState} size={160} />
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
          <AnimatePresence initial={false}>
            {chatMessages.map((msg, i) => (
              <ChatMessage
                key={i}
                role={msg.role}
                content={msg.content}
                photos={msg.photos}
              />
            ))}
          </AnimatePresence>

          {/* Streaming indicator */}
          {isStreaming && streamingContent && (
            <ChatMessage role="rabbit" content={streamingContent} isStreaming />
          )}

          {/* Inline photo upload */}
          {(view === "upload" || showPhotoUpload) && activeProjectId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-2"
            >
              <PhotoUploadInline
                photos={photos}
                isUploading={isBatchUploading}
                uploadProgress={isBatchUploading ? uploadProgress : undefined}
                onUpload={handlePhotoUpload}
                onToggleFavorite={(id, cur) => updatePhoto.mutate({ id, projectId: activeProjectId, is_favorite: !cur })}
                onDelete={(id, path) => deletePhoto.mutate({ id, projectId: activeProjectId, storagePath: path })}
              />

              {canContinueToInterview && (
                <div className="mt-4 text-center">
                  <Button
                    size="sm"
                    className="rounded-xl gap-2"
                    style={{ background: "#C4956A", color: "white" }}
                    onClick={handleContinueToInterview}
                  >
                    That's all my photos — let's go!
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* Finish interview button */}
          {view === "interview" && canFinish && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-3"
            >
              <Button
                size="sm"
                className="rounded-xl gap-2"
                style={{ background: "#C4956A", color: "white" }}
                onClick={handleFinishInterview}
              >
                <CheckCircle className="w-4 h-4" /> I've shared enough — make my book!
              </Button>
            </motion.div>
          )}
        </div>

        {/* Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onPhotos={activeProjectId ? handlePhotoUpload : undefined}
          disabled={isStreaming}
          placeholder={
            view === "interview"
              ? "Share a memory..."
              : view === "upload"
              ? "Tell Rabbit about these photos..."
              : "Tell Rabbit what you're making..."
          }
          showPhotoButton={view !== "interview"}
        />
      </div>

      {/* Project shelf */}
      <ProjectShelf
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={handleSelectProject}
        onNew={handleNewProject}
      />
    </div>
  );
};

export default Workspace;
