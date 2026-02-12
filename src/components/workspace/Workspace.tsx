// Workspace – main project view
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, ChevronDown, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import PhotoUploadInline from "./PhotoUploadInline";
import ProjectShelf from "./ProjectShelf";
import GenerationView from "./GenerationView";
import MinimalNav from "./MinimalNav";
import { useProject, useProjects, useCreateMinimalProject, useUpdateProjectStatus } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto, getPhotoUrl } from "@/hooks/usePhotos";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useInterviewMessages, useInterviewChat, useAutoFillInterview, useClearInterview, type SeedOption } from "@/hooks/useInterview";
import { isDevMode } from "@/lib/devMode";
import { supabase } from "@/integrations/supabase/client";

type WorkspaceView = "loading" | "home" | "upload" | "interview" | "generating" | "review";

interface WorkspaceProps {
  projectId?: string;
}

const Workspace = ({ projectId: propProjectId }: WorkspaceProps) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const resolvedId = propProjectId || paramId;

  const { data: projects = [] } = useProjects();
  const { data: project, isLoading: projectLoading } = useProject(resolvedId);
  const { data: photos = [] } = usePhotos(resolvedId);
  const { data: interviewMessages = [] } = useInterviewMessages(resolvedId);
  const { sendMessage, isStreaming, streamingContent, lastFinishedContent } = useInterviewChat(resolvedId);
  const createProject = useCreateMinimalProject();
  const updateStatus = useUpdateProjectStatus();
  const { uploadBatch, uploadProgress, isBatchUploading } = useUploadPhoto();
  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();

  const [input, setInput] = useState("");
  const [photoStripOpen, setPhotoStripOpen] = useState(false);
  const [seedMenuOpen, setSeedMenuOpen] = useState(false);
  const autoFill = useAutoFillInterview(resolvedId);
  const clearInterview = useClearInterview(resolvedId);
  const [rabbitState, setRabbitState] = useState<RabbitState>("idle");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[] }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(resolvedId || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectCreatedRef = useRef(false);

  // FIX #1: Sync activeProjectId with URL params (back button, external nav)
  useEffect(() => {
    setActiveProjectId(resolvedId || null);
    // Reset creation guard when navigating to a different project or home
    projectCreatedRef.current = false;
  }, [resolvedId]);

  // FIX #2: Add "loading" view to prevent flash of wrong content
  const view: WorkspaceView = resolvedId && projectLoading
    ? "loading"
    : !activeProjectId || !project
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

  // FIX #3: Review redirect via useEffect instead of during render
  useEffect(() => {
    if (view === "review" && activeProjectId) {
      navigate(`/project/${activeProjectId}/review`);
    }
  }, [view, activeProjectId, navigate]);

  // Update rabbit state based on view
  useEffect(() => {
    if (view === "generating") setRabbitState("painting");
    else if (view === "interview") setRabbitState("listening");
    else if ((view === "upload" || view === "home") && photos.length > 0) setRabbitState("excited");
    else if (view === "review") setRabbitState("presenting");
    else if (view !== "loading") setRabbitState("idle");
  }, [view, photos.length]);

  // Auto-create project when first photos are dropped (home view)
  const handlePhotoUpload = async (files: File[]) => {
    let pid = activeProjectId;

    // If no project yet, create one
    if (!pid && !projectCreatedRef.current) {
      projectCreatedRef.current = true;
      try {
        const newProject = await createProject.mutateAsync();
        pid = newProject.id;
        setActiveProjectId(pid);
        navigate(`/project/${pid}`);
      } catch {
        projectCreatedRef.current = false;
        return;
      }
    }

    if (!pid) return;
    uploadBatch(pid, files);
    setRabbitState("excited");
  };

  const handleNewProject = async () => {
    try {
      const newProj = await createProject.mutateAsync();
      setActiveProjectId(newProj.id);
      navigate(`/project/${newProj.id}`);
      setChatMessages([]);
      setRabbitState("idle");
    } catch {
      // handled by mutation
    }
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    navigate(`/project/${id}`);
  };

  // ─── Interview chat ─────────────────────────────────────────
  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    setChatMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    scrollToBottom();

    if (view === "interview" && project) {
      const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
      sendMessage(text, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type);
      setRabbitState("thinking");
    }
  };

  // Show finished interview responses as chat messages
  useEffect(() => {
    if (lastFinishedContent) {
      setChatMessages(prev => [...prev, { role: "rabbit", content: lastFinishedContent }]);
      setRabbitState("listening");
      scrollToBottom();
    }
  }, [lastFinishedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && streamingContent) {
      scrollToBottom();
    }
  }, [streamingContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX #4: Only restore DB messages on fresh load (no local greeting yet)
  useEffect(() => {
    if (view !== "interview" || interviewMessages.length === 0) return;
    // Only populate if our local chat is completely empty (fresh page load)
    if (chatMessages.length > 0) return;
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
    setChatMessages([{
      role: "rabbit",
      content: `I've studied all your photos — I can see ${project?.pet_name || "them"} so clearly! Now tell me the stories behind the pictures. What should I know?`,
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

  // ─── Loading state (prevents flash of wrong view) ────────────
  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
      </div>
    );
  }

  // ─── Review: handled by useEffect redirect above ─────────────
  if (view === "review") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FDF8F0" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C4956A" }} />
      </div>
    );
  }

  // ─── Generating view ────────────────────────────────────────
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

  // ─── Home / Upload views: PHOTOS FIRST, no chat ─────────────
  if (view === "home" || view === "upload") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
        <MinimalNav />

        <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto overflow-hidden">
          {/* Rabbit */}
          <div className="flex justify-center py-6 shrink-0">
            <RabbitCharacter state={rabbitState} size={160} />
          </div>

          {/* Upload-focused content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
            {/* Rabbit greeting */}
            <ChatMessage
              role="rabbit"
              content={
                photos.length === 0
                  ? "Drop your photos here — I'll study every detail so we can make something amazing."
                  : photos.length < 5
                  ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} so far — a few more will really help me tell the story.`
                  : isBatchUploading
                  ? "I'm studying your photos right now..."
                  : `${photos.length} photos! I can already picture the book. Ready when you are.`
              }
            />

            {/* Photo upload zone + grid */}
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
                onToggleFavorite={activeProjectId ? (id, cur) => updatePhoto.mutate({ id, projectId: activeProjectId, is_favorite: !cur }) : undefined}
                onDelete={activeProjectId ? (id, path) => deletePhoto.mutate({ id, projectId: activeProjectId, storagePath: path }) : undefined}
              />

              {canContinueToInterview && (
                <div className="mt-6 text-center">
                  <Button
                    size="lg"
                    className="rounded-xl gap-2 px-8"
                    style={{ background: "#C4956A", color: "white" }}
                    onClick={handleContinueToInterview}
                  >
                    That's all my photos — let's go!
                  </Button>
                  <p className="font-body text-xs mt-2" style={{ color: "#9B8E7F" }}>
                    Or keep adding more photos
                  </p>
                </div>
              )}
            </motion.div>
          </div>
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
  }

  // ─── Interview view: NOW the chat opens ─────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FDF8F0" }}>
      <MinimalNav />

      <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto overflow-hidden">
        {/* Rabbit */}
        <div className="flex justify-center py-4 shrink-0">
          <RabbitCharacter state={rabbitState} size={140} />
        </div>

        {/* Photo strip */}
        {photos.length > 0 && (
          <Collapsible open={photoStripOpen} onOpenChange={setPhotoStripOpen} className="px-4 md:px-0 shrink-0">
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 group cursor-pointer">
              <div className="flex -space-x-2">
                {photos.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="w-8 h-8 rounded-full overflow-hidden border-2 shrink-0"
                    style={{ borderColor: "#FDF8F0" }}
                  >
                    <img
                      src={getPhotoUrl(p.storage_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <span className="font-body text-xs flex items-center gap-1" style={{ color: "#9B8E7F" }}>
                <Camera className="w-3 h-3" />
                {photos.length} photo{photos.length !== 1 ? "s" : ""}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 ml-auto transition-transform duration-200"
                style={{ color: "#9B8E7F", transform: photoStripOpen ? "rotate(180deg)" : undefined }}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide">
                {photos.slice(0, 12).map((p) => (
                  <div
                    key={p.id}
                    className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border"
                    style={{ borderColor: "#E8D5C0" }}
                  >
                    <img
                      src={getPhotoUrl(p.storage_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {photos.length > 12 && (
                  <div
                    className="shrink-0 w-16 h-16 rounded-lg flex items-center justify-center font-body text-xs"
                    style={{ background: "#F5EDE4", color: "#9B8E7F" }}
                  >
                    +{photos.length - 12} more
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

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

          {/* Finish interview button */}
          {canFinish && (
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

        {/* Dev toolbar */}
        {isDevMode() && (
          <div className="flex items-center gap-2 px-4 py-1 text-xs" style={{ color: "#9B8E7F" }}>
            <span className="font-mono opacity-60">DEV</span>
            <div className="relative">
              <button
                className="px-2 py-0.5 rounded border font-mono hover:bg-black/5"
                style={{ borderColor: "#D5C8B8" }}
                onClick={() => setSeedMenuOpen(!seedMenuOpen)}
              >
                Auto-fill ▾
              </button>
              {seedMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-white rounded shadow-lg border z-50 min-w-[140px]" style={{ borderColor: "#D5C8B8" }}>
                  {(["link", "luna", "max"] as SeedOption[]).map(seed => (
                    <button
                      key={seed}
                      className="block w-full text-left px-3 py-1.5 hover:bg-black/5 font-mono text-xs"
                      onClick={() => {
                        setSeedMenuOpen(false);
                        autoFill.mutate(seed, {
                          onSuccess: () => {
                            // Sync local chat state from DB after auto-fill
                            setTimeout(() => {
                              const msgs = document.querySelectorAll("[data-chat]");
                              // Let react-query refetch handle it — just clear local state so restore effect runs
                              setChatMessages([]);
                            }, 300);
                          },
                        });
                      }}
                    >
                      {seed === "link" ? "Link (full)" : seed === "luna" ? "Luna (cat)" : "Max (short)"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="px-2 py-0.5 rounded border font-mono hover:bg-black/5"
              style={{ borderColor: "#D5C8B8" }}
              onClick={() => {
                clearInterview.mutate(undefined, {
                  onSuccess: () => setChatMessages([]),
                });
              }}
            >
              Clear
            </button>
            {(autoFill.isPending || clearInterview.isPending) && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
          </div>
        )}

        {/* Chat input — ONLY during interview */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          disabled={isStreaming}
          placeholder="Share a memory..."
          showPhotoButton={false}
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
