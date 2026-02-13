// Workspace – persistent chat interface. The rabbit is the sandbox.
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
import { useProject, useProjects, useCreateMinimalProject, useUpdateProjectStatus, useUpdateProject, useDeleteProject } from "@/hooks/useProject";
import MoodPicker from "./MoodPicker";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto, getPhotoUrl } from "@/hooks/usePhotos";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useInterviewMessages, useInterviewChat, useAutoFillInterview, useClearInterview, type SeedOption } from "@/hooks/useInterview";
import { isDevMode } from "@/lib/devMode";
import { supabase } from "@/integrations/supabase/client";

type WorkspacePhase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

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
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
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

  // Sync activeProjectId with URL params
  useEffect(() => {
    setActiveProjectId(resolvedId || null);
    projectCreatedRef.current = false;
  }, [resolvedId]);

  // Derive phase from project state
  const phase: WorkspacePhase = resolvedId && projectLoading
    ? "home" // show chat while loading
    : !activeProjectId || !project
    ? "home"
    : !project.mood ? "mood-picker"
    : project.status === "upload" ? "upload"
    : project.status === "interview" ? "interview"
    : project.status === "generating" ? "generating"
    : project.status === "review" ? "review"
    : "upload";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 100);
  }, []);

  // Review redirect
  useEffect(() => {
    if (phase === "review" && activeProjectId) {
      navigate(`/project/${activeProjectId}/review`);
    }
  }, [phase, activeProjectId, navigate]);

  // Update rabbit state based on phase
  useEffect(() => {
    if (phase === "generating") setRabbitState("painting");
    else if (phase === "interview") setRabbitState("listening");
    else if ((phase === "upload" || phase === "home") && photos.length > 0) setRabbitState("excited");
    else if (phase === "review") setRabbitState("presenting");
    else setRabbitState("idle");
  }, [phase, photos.length]);

  // ─── Handlers ─────────────────────────────────────────────

  const handlePhotoUpload = async (files: File[]) => {
    let pid = activeProjectId;
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
    } catch { /* handled */ }
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    navigate(`/project/${id}`);
  };

  const handleRenameProject = (id: string, newName: string) => {
    updateProject.mutate({ id, pet_name: newName });
  };

  const handleDeleteProject = (id: string) => {
    deleteProject.mutate(id);
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
        navigate(`/project/${remaining[0].id}`);
      } else {
        setActiveProjectId(null);
        navigate("/");
      }
    }
  };

  // ─── Interview chat ─────────────────────────────────────────

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setChatMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    scrollToBottom();

    if ((phase === "interview" || phase === "generating") && project) {
      const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
      sendMessage(text, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type, project.mood);
      setRabbitState("thinking");
    }
  };

  useEffect(() => {
    if (lastFinishedContent) {
      setChatMessages(prev => [...prev, { role: "rabbit", content: lastFinishedContent }]);
      setRabbitState(phase === "generating" ? "painting" : "listening");
      scrollToBottom();
    }
  }, [lastFinishedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isStreaming && streamingContent) scrollToBottom();
  }, [streamingContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore DB messages on fresh load
  useEffect(() => {
    if (phase !== "interview" && phase !== "generating") return;
    if (interviewMessages.length === 0 || chatMessages.length > 0) return;
    const restored = interviewMessages.map(m => ({
      role: (m.role === "assistant" ? "rabbit" : "user") as "rabbit" | "user",
      content: m.content,
    }));
    setChatMessages(restored);
  }, [phase, interviewMessages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Adaptive greetings
  const shortGreetings: Record<string, string> = {
    funny: `Tell me about this — what's the funniest thing about ${project?.pet_name || "them"}?`,
    heartfelt: `Tell me about this moment — what makes it special?`,
    adventure: `What's the story behind this? I want to hear it all.`,
    memorial: `Tell me about them — what do you want people to remember?`,
  };
  const fullGreetings: Record<string, string> = {
    funny: `I've studied all your photos — I can already tell ${project?.pet_name || "they"} is a character! What's the most ridiculous thing they've ever done?`,
    heartfelt: `I've studied all your photos — I can see the bond you share with ${project?.pet_name || "them"}. Take your time — tell me about them.`,
    adventure: `I've studied all your photos — ${project?.pet_name || "they"} looks like a real explorer! What's their greatest adventure?`,
    memorial: `I've studied all your photos of ${project?.pet_name || "them"} — what a beautiful life. Take your time — tell me about them.`,
  };

  const handleContinueToInterview = () => {
    if (!activeProjectId || !project?.mood) return;
    supabase.functions.invoke("build-appearance-profile", {
      body: { projectId: activeProjectId },
    });
    startInterview(project.mood);
  };

  const handleMoodSelect = (mood: string, name: string) => {
    if (!activeProjectId) return;
    updateProject.mutate({ id: activeProjectId, mood, pet_name: name });
  };

  const startInterview = (mood: string) => {
    if (!activeProjectId) return;
    updateStatus.mutate({ id: activeProjectId, status: "interview" });
    const greetings = photos.length <= 3 ? shortGreetings : fullGreetings;
    const greeting = greetings[mood] || greetings.heartfelt;
    setChatMessages([{ role: "rabbit", content: greeting }]);
    setRabbitState("listening");
    scrollToBottom();
  };

  const handleFinishInterview = () => {
    if (!activeProjectId) return;
    updateStatus.mutate({ id: activeProjectId, status: "generating" });
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `I have everything I need. Watch this — I'm going to paint ${project?.pet_name || "your"} book! Keep chatting while I work.`,
    }]);
  };

  const handleGenerationComplete = () => {
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `Your book is ready! Let me show you what I made.`,
    }]);
    setRabbitState("presenting");
    scrollToBottom();
  };

  const userInterviewCount = interviewMessages.filter(m => m.role === "user").length;
  const canFinish = photos.length <= 3 ? userInterviewCount >= 1 : userInterviewCount >= 2;
  const canContinueToInterview = photos.length >= 1 && !isBatchUploading;

  // Rabbit greeting based on phase
  const getRabbitGreeting = () => {
    if (phase === "home" && photos.length === 0) {
      return "Drop your photos here — I'll study every detail so we can make something amazing.";
    }
    if ((phase === "home" || phase === "upload") && isBatchUploading) {
      return "I'm studying your photos right now...";
    }
    if ((phase === "home" || phase === "upload") && photos.length > 0 && photos.length < 3) {
      return `${photos.length} photo${photos.length !== 1 ? "s" : ""} — add more for a richer story, or continue when you're ready.`;
    }
    if ((phase === "home" || phase === "upload") && photos.length >= 3) {
      return `${photos.length} photos! I can already picture the book. Ready when you are.`;
    }
    return null; // Chat messages handle everything in later phases
  };

  // ─── Single unified layout ─────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <MinimalNav />

      <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto overflow-hidden">
        {/* Rabbit — always present, always centered */}
        <div className="flex justify-center py-3 shrink-0">
          <RabbitCharacter state={rabbitState} size={phase === "generating" ? 100 : 140} />
        </div>

        {/* Generation progress — compact bar above chat during generation */}
        {phase === "generating" && (
          <div className="shrink-0 px-4 md:px-0 pb-2">
            <GenerationView
              projectId={activeProjectId!}
              petName={project?.pet_name || "your story"}
              onComplete={handleGenerationComplete}
            />
          </div>
        )}

        {/* Photo strip — visible during interview and generating */}
        {photos.length > 0 && (phase === "interview" || phase === "generating") && (
          <Collapsible open={photoStripOpen} onOpenChange={setPhotoStripOpen} className="px-4 md:px-0 shrink-0">
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-1.5 group cursor-pointer">
              <div className="flex -space-x-2">
                {photos.slice(0, 6).map((p) => (
                  <div key={p.id} className="w-8 h-8 rounded-full overflow-hidden border-2 border-background shrink-0">
                    <img src={getPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span className="font-body text-xs flex items-center gap-1 text-muted-foreground">
                <Camera className="w-3 h-3" />
                {photos.length} photo{photos.length !== 1 ? "s" : ""}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 ml-auto transition-transform duration-200 text-muted-foreground"
                style={{ transform: photoStripOpen ? "rotate(180deg)" : undefined }}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-hide">
                {photos.map((p) => (
                  <div key={p.id} className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={getPhotoUrl(p.storage_path)} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ─── Chat scroll area — THE core interface ─── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-4 pb-4">
          {/* Phase: Upload — upload widget appears in chat context */}
          {(phase === "home" || phase === "upload" || phase === "mood-picker") && (
            <>
              {/* Rabbit greeting as chat message */}
              {getRabbitGreeting() && (
                <ChatMessage role="rabbit" content={getRabbitGreeting()!} />
              )}

              {/* Upload zone in chat flow */}
              <ChatMessage role="rabbit" content="">
                <PhotoUploadInline
                  photos={photos}
                  isUploading={isBatchUploading}
                  uploadProgress={isBatchUploading ? uploadProgress : undefined}
                  onUpload={handlePhotoUpload}
                  onToggleFavorite={activeProjectId ? (id, cur) => updatePhoto.mutate({ id, projectId: activeProjectId, is_favorite: !cur }) : undefined}
                  onDelete={activeProjectId ? (id, path) => deletePhoto.mutate({ id, projectId: activeProjectId, storagePath: path }) : undefined}
                />
              </ChatMessage>

              {/* Continue button */}
              {canContinueToInterview && phase === "upload" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-2">
                  <Button
                    size="lg"
                    className="rounded-xl gap-2 px-8 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleContinueToInterview}
                  >
                    That's all my photos — let's go!
                  </Button>
                  <p className="font-body text-xs mt-2 text-muted-foreground">Or keep adding more photos</p>
                </motion.div>
              )}

              {/* Mood picker in chat flow */}
              {phase === "mood-picker" && (
                <ChatMessage role="rabbit" content="">
                  <MoodPicker
                    petName={project?.pet_name || "your subject"}
                    onSelect={handleMoodSelect}
                  />
                </ChatMessage>
              )}
            </>
          )}

          {/* Phase: Interview + Generating — chat messages */}
          {(phase === "interview" || phase === "generating" || phase === "review") && (
            <>
              <AnimatePresence initial={false}>
                {chatMessages.map((msg, i) => (
                  <ChatMessage key={i} role={msg.role} content={msg.content} photos={msg.photos} />
                ))}
              </AnimatePresence>

              {isStreaming && streamingContent && (
                <ChatMessage role="rabbit" content={streamingContent} isStreaming />
              )}

              {/* Finish interview button */}
              {phase === "interview" && canFinish && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-3">
                  <Button
                    size="sm"
                    className="rounded-xl gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleFinishInterview}
                  >
                    <CheckCircle className="w-4 h-4" /> I've shared enough — make my book!
                  </Button>
                </motion.div>
              )}

              {/* Review CTA */}
              {phase === "review" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-3">
                  <Button
                    size="lg"
                    className="rounded-xl gap-2 px-8 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => activeProjectId && navigate(`/project/${activeProjectId}/review`)}
                  >
                    Review your book
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Dev toolbar */}
        {isDevMode() && phase === "interview" && (
          <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground">
            <span className="font-mono opacity-60">DEV</span>
            <div className="relative">
              <button
                className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
                onClick={() => setSeedMenuOpen(!seedMenuOpen)}
              >
                Auto-fill ▾
              </button>
              {seedMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1 bg-card rounded shadow-lg border border-border z-50 min-w-[140px]">
                  {(["link", "luna", "max"] as SeedOption[]).map(seed => (
                    <button
                      key={seed}
                      className="block w-full text-left px-3 py-1.5 hover:bg-black/5 font-mono text-xs"
                      onClick={() => {
                        setSeedMenuOpen(false);
                        autoFill.mutate(seed, {
                          onSuccess: () => setTimeout(() => setChatMessages([]), 300),
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
              className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
              onClick={() => clearInterview.mutate(undefined, { onSuccess: () => setChatMessages([]) })}
            >
              Clear
            </button>
            {(autoFill.isPending || clearInterview.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
        )}

        {/* Chat input — ALWAYS visible */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onPhotos={(phase === "home" || phase === "upload" || phase === "mood-picker") ? handlePhotoUpload : undefined}
          disabled={isStreaming}
          placeholder={
            phase === "generating"
              ? "Chat while I paint..."
              : phase === "interview"
              ? "Share a memory..."
              : "Drop photos or say hi..."
          }
          showPhotoButton={phase === "home" || phase === "upload" || phase === "mood-picker"}
        />
      </div>

      {/* Project shelf */}
      <ProjectShelf
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={handleSelectProject}
        onNew={handleNewProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
      />
    </div>
  );
};

export default Workspace;
