// PhotoRabbit – ONE screen, ONE rabbit, ONE chat. The entire app.
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, ChevronDown, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage from "@/components/workspace/ChatMessage";
import ChatInput from "@/components/workspace/ChatInput";
import PhotoUploadInline from "@/components/workspace/PhotoUploadInline";
import ProjectShelf from "@/components/workspace/ProjectShelf";
import GenerationView from "@/components/workspace/GenerationView";
import MinimalNav from "@/components/workspace/MinimalNav";
import MoodPicker from "@/components/workspace/MoodPicker";
import AuthInline from "@/components/workspace/AuthInline";
import BookReview from "@/components/project/BookReview";
import { useProject, useProjects, useCreateMinimalProject, useUpdateProjectStatus, useUpdateProject, useDeleteProject } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto, getPhotoUrl } from "@/hooks/usePhotos";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useInterviewMessages, useInterviewChat, useAutoFillInterview, useClearInterview, type SeedOption } from "@/hooks/useInterview";
import { isDevMode, enableDevMode } from "@/lib/devMode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Phase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

const DEV_EMAIL = "dev@photorabbit.test";
const DEV_PASSWORD = "devmode123";

const PhotoRabbit = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  // ─── Dev mode auto-sign-in ─────────────────────────────────
  const [devSigningIn, setDevSigningIn] = useState(false);

  useEffect(() => {
    if (!isDevMode() || user || authLoading || devSigningIn) return;
    const autoSignIn = async () => {
      setDevSigningIn(true);
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-dev-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
          }
        );
        await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
      } catch (e) {
        console.error("Dev auto-sign-in failed:", e);
      } finally {
        setDevSigningIn(false);
      }
    };
    autoSignIn();
  }, [user, authLoading, devSigningIn]);

  // Show loader while dev mode is signing in
  if (isDevMode() && (!user || devSigningIn || authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <PhotoRabbitInner paramId={paramId} />;
};

// ─── Inner component (after auth resolved) ─────────────────────
interface InnerProps {
  paramId?: string;
}

const PhotoRabbitInner = ({ paramId }: InnerProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projects = [] } = useProjects();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(paramId || null);

  const { data: project, isLoading: projectLoading } = useProject(activeProjectId || undefined);
  const { data: photos = [] } = usePhotos(activeProjectId || undefined);
  const { data: interviewMessages = [] } = useInterviewMessages(activeProjectId || undefined);
  const { sendMessage, isStreaming, streamingContent, lastFinishedContent } = useInterviewChat(activeProjectId || undefined);
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
  const autoFill = useAutoFillInterview(activeProjectId || undefined);
  const clearInterview = useClearInterview(activeProjectId || undefined);
  const [rabbitState, setRabbitState] = useState<RabbitState>("idle");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[] }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const unauthFileRef = useRef<HTMLInputElement>(null);
  const projectCreatedRef = useRef(false);

  // Sync activeProjectId with URL params
  useEffect(() => {
    setActiveProjectId(paramId || null);
    projectCreatedRef.current = false;
  }, [paramId]);

  // Derive phase from project state
  const phase: Phase = activeProjectId && projectLoading
    ? "home"
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
    if (!user) {
      const images = files.filter(f => f.type.startsWith("image/"));
      if (images.length === 0) return;
      const urls = images.map(f => URL.createObjectURL(f));
      setPendingPreviews(prev => [...prev, ...urls]);
      setChatMessages(prev => [
        ...prev,
        { role: "user" as const, content: "", photos: urls },
        { role: "rabbit" as const, content: "Love these! Sign in and I'll start turning them into something amazing." },
      ]);
      setRabbitState("excited");
      scrollToBottom();
      return;
    }

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

    if (!user) {
      const responses = [
        "I turn photos into illustrated storybooks — drop some in and sign in to get started!",
        "Any photos work — pets, kids, trips, adventures. Drop a few and let's make something.",
        "I'm ready when you are! Just drop some photos to begin.",
      ];
      const rabbitCount = chatMessages.filter(m => m.role === "rabbit").length;
      const idx = rabbitCount % responses.length;
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: "rabbit", content: responses[idx] }]);
        scrollToBottom();
      }, 500);
      return;
    }

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

  const handleBackFromReview = () => {
    // Return to generating/interview phase — set review back so chat shows
    if (activeProjectId) {
      updateStatus.mutate({ id: activeProjectId, status: "generating" });
    }
  };

  const userInterviewCount = interviewMessages.filter(m => m.role === "user").length;
  const canFinish = photos.length <= 3 ? userInterviewCount >= 1 : userInterviewCount >= 2;
  const canContinueToInterview = photos.length >= 1 && !isBatchUploading;

  // Rabbit greeting based on phase
  const getRabbitGreeting = () => {
    if (!user) {
      return "I'm Rabbit. Drop some photos and I'll turn them into a custom illustrated book — pets, kids, trips, anything.";
    }
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
    return null;
  };

  // ─── Review phase renders BookReview instead of chat ─────────
  if (phase === "review" && activeProjectId) {
    return (
      <div
        className="h-screen flex flex-col bg-background overflow-hidden"
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
          if (files.length > 0) handlePhotoUpload(files);
        }}
      >
        <MinimalNav />
        <BookReview projectId={activeProjectId} onBack={handleBackFromReview} />
        {user && (
          <ProjectShelf
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={handleSelectProject}
            onNew={handleNewProject}
            onRename={handleRenameProject}
            onDelete={handleDeleteProject}
          />
        )}
      </div>
    );
  }

  // ─── Single unified layout ─────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (files.length > 0) handlePhotoUpload(files);
      }}
    >
      <MinimalNav />

      <div className="flex-1 flex flex-col max-w-[700px] w-full mx-auto overflow-hidden">
        {/* Rabbit — always present */}
        {phase !== "generating" && (
          <div className="flex justify-center pt-6 pb-2 shrink-0">
            <RabbitCharacter state={rabbitState} size={140} />
          </div>
        )}

        {/* Generation progress — takes over rabbit area during generation */}
        {phase === "generating" && (
          <div className="shrink-0 px-4 md:px-0 pb-2">
            <GenerationView
              projectId={activeProjectId!}
              petName={project?.pet_name || "your story"}
              onComplete={handleGenerationComplete}
              hideRabbit={false}
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-0 space-y-5 pb-4">
          {/* Phase: Upload — upload widget appears in chat context */}
          {(phase === "home" || phase === "upload" || phase === "mood-picker") && (
            <>
              {/* Rabbit greeting as chat message */}
              {getRabbitGreeting() && (
                <ChatMessage role="rabbit" content={getRabbitGreeting()!} />
              )}

              {/* Upload zone — simple for unauth, full for auth */}
              {!user ? (
                <>
                  <ChatMessage role="rabbit" content="">
                    <div
                      onClick={() => unauthFileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePhotoUpload(Array.from(e.dataTransfer.files));
                      }}
                      className="rounded-[20px] border border-border/60 p-6 text-center cursor-pointer transition-all bg-card shadow-chat hover:shadow-md hover:border-primary/40"
                    >
                      <input
                        type="file"
                        ref={unauthFileRef}
                        className="sr-only"
                        accept="image/*"
                        multiple
                        onChange={e => e.target.files && handlePhotoUpload(Array.from(e.target.files))}
                      />
                      <Upload className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="font-body text-sm text-muted-foreground">
                        Drop photos here or click to browse
                      </p>
                    </div>
                  </ChatMessage>

                  {/* Unauth chat messages */}
                  <AnimatePresence initial={false}>
                    {chatMessages.map((msg, i) => (
                      <ChatMessage key={i} role={msg.role} content={msg.content} photos={msg.photos} />
                    ))}
                  </AnimatePresence>

                  {/* Auth gate when photos pending */}
                  {pendingPreviews.length > 0 && (
                    <ChatMessage role="rabbit" content="">
                      <AuthInline />
                    </ChatMessage>
                  )}
                </>
              ) : (
                <>
                  {/* Auth'd upload zone */}
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
            </>
          )}

          {/* Phase: Interview + Generating — chat messages */}
          {(phase === "interview" || phase === "generating") && (
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
            </>
          )}
        </div>

        {/* Dev toolbar */}
        {isDevMode() && ["upload", "mood-picker", "interview", "generating"].includes(phase) && (
          <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground flex-wrap">
            <span className="font-mono opacity-60">DEV</span>

            {(phase === "interview" || phase === "generating") && (
              <div className="relative">
                <button
                  className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
                  onClick={() => setSeedMenuOpen(!seedMenuOpen)}
                >
                  Auto-fill DB ▾
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
            )}

            <button
              className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
              onClick={() => {
                const seed = [
                  { role: "rabbit" as const, content: "Drop your photos — I'll study every detail." },
                  { role: "user" as const, content: "Here's my dog Max, he's the best boy ever." },
                  { role: "rabbit" as const, content: "I can already tell Max is a character! What's the most ridiculous thing he's ever done?" },
                  { role: "user" as const, content: "He brings me his ball every morning and drops it on my face while I'm sleeping." },
                  { role: "rabbit" as const, content: "A golden retriever alarm clock! Ball on the face is such a dedicated move. What does Max do after you wake up?" },
                  { role: "user" as const, content: "Full body wiggle, he can't contain himself." },
                  { role: "rabbit" as const, content: "The full body wiggle! Joy they literally can't keep inside. I have everything I need — let me paint this book!" },
                ];
                setChatMessages(seed);
                scrollToBottom();
              }}
            >
              Fill Chat UI
            </button>

            <button
              className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
              onClick={() => clearInterview.mutate(undefined, { onSuccess: () => setChatMessages([]) })}
            >
              Clear
            </button>

            {(phase === "upload" || phase === "mood-picker") && (
              <button
                className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
                onClick={() => activeProjectId && updateStatus.mutate({ id: activeProjectId, status: "interview" })}
              >
                → Interview
              </button>
            )}
            {(phase === "upload" || phase === "mood-picker" || phase === "interview") && (
              <button
                className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
                onClick={() => activeProjectId && updateStatus.mutate({ id: activeProjectId, status: "generating" })}
              >
                → Generating
              </button>
            )}
            {(phase === "upload" || phase === "mood-picker" || phase === "interview" || phase === "generating") && (
              <button
                className="px-2 py-0.5 rounded border border-border font-mono hover:bg-black/5"
                onClick={() => activeProjectId && updateStatus.mutate({ id: activeProjectId, status: "review" })}
              >
                → Review
              </button>
            )}

            {(autoFill.isPending || clearInterview.isPending) && <Loader2 className="w-3 h-3 animate-spin" />}
          </div>
        )}

        {/* Chat input — always visible in non-review phases */}
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

      {/* Project shelf — only for auth'd users */}
      {user && (
        <ProjectShelf
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={handleSelectProject}
          onNew={handleNewProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
        />
      )}

      {/* Footer for unauth */}
      {!user && (
        <div className="flex items-center justify-center gap-3 py-3 font-body text-[11px] text-muted-foreground/50">
          <span>PhotoRabbit</span>
          <span>&copy; {new Date().getFullYear()}</span>
          <button
            onClick={() => { enableDevMode(); window.location.reload(); }}
            className="opacity-0 hover:opacity-100 transition-opacity"
          >
            Dev
          </button>
        </div>
      )}
    </div>
  );
};

export default PhotoRabbit;
