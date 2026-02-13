// PhotoRabbit – Split layout: chat left, sandbox right. The entire app.
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import RabbitCharacter, { type RabbitState } from "@/components/rabbit/RabbitCharacter";
import ChatMessage, { TypingIndicator } from "@/components/workspace/ChatMessage";
import ChatInput from "@/components/workspace/ChatInput";
import ProjectShelf from "@/components/workspace/ProjectShelf";
import MinimalNav from "@/components/workspace/MinimalNav";
import WorkspaceSandbox from "@/components/workspace/WorkspaceSandbox";
import HeroLanding from "@/components/workspace/HeroLanding";
import { useProject, useProjects, useCreateMinimalProject, useUpdateProjectStatus, useUpdateProject, useDeleteProject } from "@/hooks/useProject";
import { usePhotos, useUploadPhoto, useUpdatePhoto, useDeletePhoto } from "@/hooks/usePhotos";
import { useInterviewMessages, useInterviewChat, useAutoFillInterview, useClearInterview, type SeedOption } from "@/hooks/useInterview";
import { isDevMode, enableDevMode } from "@/lib/devMode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useCredits } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import CreditGate from "@/components/workspace/CreditGate";

type Phase = "home" | "upload" | "mood-picker" | "interview" | "generating" | "review";

const DEV_EMAIL = "dev@photorabbit.test";
const DEV_PASSWORD = "devmode123";

const PhotoRabbit = () => {
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
  const isMobile = useIsMobile();

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
  const { balance, deduct, fetchBalance } = useCredits();
  const [showCreditGate, setShowCreditGate] = useState(false);

  const [input, setInput] = useState("");
  const [seedMenuOpen, setSeedMenuOpen] = useState(false);
  const autoFill = useAutoFillInterview(activeProjectId || undefined);
  const clearInterview = useClearInterview(activeProjectId || undefined);
  const [rabbitState, setRabbitState] = useState<RabbitState>("idle");
  const [isFinishing, setIsFinishing] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[] }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const unauthFileRef = useRef<HTMLInputElement>(null);
  const projectCreatedRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);
  // Mobile sandbox collapsed state
  const [mobileSandboxCollapsed, setMobileSandboxCollapsed] = useState(false);

  // Sync activeProjectId with URL params
  useEffect(() => {
    setActiveProjectId(paramId || null);
    projectCreatedRef.current = false;
  }, [paramId]);

  // Auto-recover stale "generating" projects (closed tab, crashed browser)
  const isStaleGenerating = project?.status === "generating" && project.updated_at &&
    (Date.now() - new Date(project.updated_at).getTime()) > 30 * 60 * 1000;

  useEffect(() => {
    if (isStaleGenerating && activeProjectId) {
      console.log("Recovering stale generating project", activeProjectId);
      updateStatus.mutate({ id: activeProjectId, status: "review" });
    }
  }, [isStaleGenerating, activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive phase from project state
  const phase: Phase = activeProjectId && projectLoading
    ? "home"
    : !activeProjectId || !project
    ? "home"
    : !project.mood ? "mood-picker"
    : project.status === "upload" ? "upload"
    : project.status === "interview" ? "interview"
    : project.status === "generating" ? (isStaleGenerating ? "review" : "generating")
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
    if (!pid && projectCreatedRef.current) {
      // Project is being created — queue these files for upload after creation
      pendingFilesRef.current = [...pendingFilesRef.current, ...files];
      setRabbitState("excited");
      return;
    }
    if (!pid && !projectCreatedRef.current) {
      projectCreatedRef.current = true;
      // Queue any concurrent drops
      pendingFilesRef.current = [...pendingFilesRef.current, ...files];
      try {
        const newProject = await createProject.mutateAsync();
        pid = newProject.id;
        setActiveProjectId(pid);
        navigate(`/project/${pid}`);
        // Upload all queued files (this batch + any that arrived during creation)
        const allFiles = pendingFilesRef.current;
        pendingFilesRef.current = [];
        uploadBatch(pid, allFiles);
        setRabbitState("excited");
        return;
      } catch {
        projectCreatedRef.current = false;
        pendingFilesRef.current = [];
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
    setChatMessages([]);
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

  // Reset rabbitState if streaming ends without content (error recovery)
  useEffect(() => {
    if (!isStreaming && rabbitState === "thinking") {
      setRabbitState(phase === "generating" ? "painting" : "listening");
    }
  }, [isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const appearanceProfilePromise = useRef<Promise<unknown> | null>(null);

  const handleContinueToInterview = () => {
    if (!activeProjectId || !project?.mood) return;
    // Store the promise so we can await it before generation starts
    appearanceProfilePromise.current = supabase.functions.invoke("build-appearance-profile", {
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
    let greeting: string;
    if (mood.startsWith("custom:")) {
      const vibe = mood.slice(7).trim();
      greeting = photos.length <= 3
        ? `Got it — "${vibe}" energy. Tell me what's going on in this photo.`
        : `Got it — "${vibe}" energy. I've studied your photos. Tell me the story.`;
    } else {
      greeting = greetings[mood] || greetings.heartfelt;
    }
    setChatMessages([{ role: "rabbit", content: greeting }]);
    setRabbitState("listening");
    scrollToBottom();
  };

  const handleFinishInterview = async () => {
    if (!activeProjectId || isFinishing) return;
    setIsFinishing(true);

    try {
    // Credit check before generation
    const currentBalance = await fetchBalance();
    if (currentBalance <= 0) {
      setShowCreditGate(true);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "I need a credit to paint your book. Let's get that sorted first!",
      }]);
      scrollToBottom();
      return;
    }

    // Deduct credit
    const success = await deduct(activeProjectId, "Book generation");
    if (!success) {
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "Something went wrong with credits. Try again?",
      }]);
      scrollToBottom();
      return;
    }

    setShowCreditGate(false);

    // Wait for appearance profile to finish before generating (prevents race condition)
    if (appearanceProfilePromise.current) {
      await appearanceProfilePromise.current.catch(() => {});
      appearanceProfilePromise.current = null;
    }

    updateStatus.mutate({ id: activeProjectId, status: "generating" });
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `I have everything I need. Watch this — I'm going to paint ${project?.pet_name || "your"} book! Keep chatting while I work.`,
    }]);
    } finally {
      setIsFinishing(false);
    }
  };

  const handleNewIllustration = useCallback((pageNum: number, url: string) => {
    setChatMessages(prev => [...prev, {
      role: "rabbit" as const,
      content: `Look at page ${pageNum}!`,
      photos: [url],
    }]);
    scrollToBottom();
  }, [scrollToBottom]);

  const handleGenerationComplete = async () => {
    // Create share link automatically on completion
    let shareMsg = "Your book is ready! Review it and share it with anyone.";
    if (activeProjectId) {
      try {
        const { data } = await supabase.functions.invoke("create-share-link", {
          body: { projectId: activeProjectId },
        });
        if (data?.shareToken) {
          const url = `${window.location.origin}/book/${data.shareToken}`;
          shareMsg = `Your book is ready! Share it with anyone: ${url}`;
        }
      } catch { /* share link creation is best-effort */ }
    }
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: shareMsg,
    }]);
    setRabbitState("presenting");
    scrollToBottom();
  };

  const handleBackFromReview = () => {
    if (activeProjectId) {
      updateStatus.mutate({ id: activeProjectId, status: "generating" });
    }
  };

  const userInterviewCount = interviewMessages.filter(m => m.role === "user").length;
  const canFinish = userInterviewCount >= 4;

  // Extract short highlights from user interview messages for generation callbacks
  const interviewHighlights = interviewMessages
    .filter(m => m.role === "user")
    .map(m => {
      // Take first ~40 chars of each user message as a highlight snippet
      const text = m.content.trim();
      if (text.length <= 40) return text.toLowerCase();
      return text.slice(0, 40).replace(/\s+\S*$/, "").toLowerCase() + "...";
    })
    .slice(0, 4);
  const canContinueToInterview = photos.length >= 1 && !isBatchUploading;

  // Show hero landing when no active project and no photos
  const showHero = phase === "home" && photos.length === 0;

  // Rabbit greeting based on phase
  const getRabbitGreeting = () => {
    if (!user) {
      return "Hey — I'm Rabbit. Drop some photos and let's make a book together.";
    }
    if (phase === "home" && photos.length === 0) {
      return "Ready when you are — drop some photos and let's get started.";
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
    if (phase === "generating") {
      return "I'm painting your book right now — watch the progress on the right!";
    }
    if (phase === "review") {
      return "Your book is ready! Review it on the right, then share it with anyone.";
    }
    return null;
  };

  // ─── Chat panel content (used for both layouts) ─────────
  const chatPanel = (
    <div className={isMobile ? "flex flex-col flex-1 min-h-0" : "workspace-chat"}>
      {/* Rabbit — smaller in split layout */}
      <div className="flex justify-center pt-4 pb-2 shrink-0">
        <RabbitCharacter state={rabbitState} size={isMobile ? 120 : 80} />
      </div>

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-5 pb-4">
        {/* Rabbit greeting */}
        {getRabbitGreeting() && (
          <ChatMessage role="rabbit" content={getRabbitGreeting()!} />
        )}

        {/* Unauth chat messages */}
        {!user && (
          <AnimatePresence initial={false}>
            {chatMessages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} photos={msg.photos} />
            ))}
          </AnimatePresence>
        )}

        {/* Interview + generating chat messages */}
        {user && (phase === "interview" || phase === "generating" || phase === "review") && (
          <>
            <AnimatePresence initial={false}>
              {chatMessages.map((msg, i) => {
                // Count user messages up to this point to insert phase dividers
                const userCountBefore = chatMessages.slice(0, i).filter(m => m.role === "user").length;
                const isUserMsg = msg.role === "user";
                const phaseLabels: Record<number, string> = {
                  3: "getting deeper...",
                  5: "the good stuff...",
                  7: "one more thing...",
                };
                const showDivider = isUserMsg && phaseLabels[userCountBefore];

                return (
                  <div key={i}>
                    {showDivider && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="flex-1 h-px bg-border/40" />
                        <span className="font-body text-[11px] text-muted-foreground/60 italic tracking-wide">
                          {phaseLabels[userCountBefore]}
                        </span>
                        <div className="flex-1 h-px bg-border/40" />
                      </motion.div>
                    )}
                    <ChatMessage role={msg.role} content={msg.content} photos={msg.photos} />
                  </div>
                );
              })}
            </AnimatePresence>

            {isStreaming && streamingContent && (
              <ChatMessage role="rabbit" content={streamingContent} isStreaming />
            )}

            {!isStreaming && rabbitState === "thinking" && phase === "interview" && (
              <TypingIndicator />
            )}

            {/* Credit gate inline */}
            {showCreditGate && (
              <CreditGate
                balance={balance ?? 0}
                onCreditAvailable={() => {
                  setShowCreditGate(false);
                  handleFinishInterview();
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Dev toolbar */}
      {isDevMode() && ["upload", "mood-picker", "interview", "generating"].includes(phase) && (
        <div className="flex items-center gap-2 px-4 py-1 text-xs text-muted-foreground flex-wrap shrink-0">
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

      {/* Chat input — always visible */}
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
  );

  // ─── Sandbox panel ─────────────────────────────────────────
  const sandboxPanel = (
    <div className={isMobile ? "flex flex-col" : "workspace-sandbox"}>
      <WorkspaceSandbox
        phase={phase}
        photos={photos}
        isBatchUploading={isBatchUploading}
        uploadProgress={isBatchUploading ? uploadProgress : undefined}
        onPhotoUpload={handlePhotoUpload}
        onToggleFavorite={activeProjectId ? (id, cur) => updatePhoto.mutate({ id, projectId: activeProjectId, is_favorite: !cur }) : undefined}
        onDeletePhoto={activeProjectId ? (id, path) => deletePhoto.mutate({ id, projectId: activeProjectId, storagePath: path }) : undefined}
        canContinueToInterview={canContinueToInterview}
        onContinueToInterview={handleContinueToInterview}
        petName={project?.pet_name || "your subject"}
        onMoodSelect={handleMoodSelect}
        canFinish={canFinish}
        userInterviewCount={userInterviewCount}
        onFinishInterview={handleFinishInterview}
        isFinishing={isFinishing}
        activeProjectId={activeProjectId}
        onGenerationComplete={handleGenerationComplete}
        onNewIllustration={handleNewIllustration}
        interviewHighlights={interviewHighlights}
        onBackFromReview={handleBackFromReview}
      />
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────
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
      <MinimalNav isHero={showHero} />

      <AnimatePresence mode="wait">
        {showHero ? (
          /* ── Hero Landing ── */
          <motion.div
            key="hero"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <HeroLanding onPhotoDrop={handlePhotoUpload} />

            {/* Chat input at bottom — "the chat never leaves" */}
            <div className="max-w-2xl mx-auto w-full">
              <ChatInput
                value={input}
                onChange={setInput}
                onSend={handleSend}
                onPhotos={handlePhotoUpload}
                disabled={false}
                placeholder="Drop photos or say hi..."
                showPhotoButton
              />
            </div>
          </motion.div>
        ) : isMobile ? (
          /* ── Mobile: stacked layout ── */
          <motion.div
            key="workspace-mobile"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Sandbox section — collapsible on mobile */}
            <div className={`shrink-0 ${mobileSandboxCollapsed ? "max-h-0 overflow-hidden" : "max-h-[50vh] overflow-y-auto border-b border-border"}`}>
              {sandboxPanel}
            </div>
            {/* Toggle button for sandbox */}
            {(phase !== "home" || activeProjectId) && (
              <button
                onClick={() => setMobileSandboxCollapsed(prev => !prev)}
                className="shrink-0 py-1.5 text-center font-body text-xs text-muted-foreground border-b border-border/50 hover:bg-secondary/50 transition-colors"
              >
                {mobileSandboxCollapsed ? "Show workspace ▼" : "Hide workspace ▲"}
              </button>
            )}
            {/* Chat section */}
            {chatPanel}
          </motion.div>
        ) : (
          /* ── Desktop: side-by-side split ── */
          <motion.div
            key="workspace-desktop"
            className="workspace-split"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {chatPanel}
            {sandboxPanel}
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Footer for unauth hero */}
      {!user && showHero && (
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
