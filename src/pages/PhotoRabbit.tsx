// PhotoRabbit – Split layout: chat left, sandbox right. The entire app.
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { getQuickReplies } from "@/lib/quickReplies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useCredits } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import CreditGate from "@/components/workspace/CreditGate";
import { toast } from "sonner";

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

  // Show loader while auth is resolving (prevents race between anon sign-in and photo drops)
  if (authLoading || (isDevMode() && (!user || devSigningIn))) {
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

  // ─── Eye tracking (mirrors HeroLanding pattern) ──────────
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!chatPanelRef.current) return;
      const rect = chatPanelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * 0.2;
      const dx = (e.clientX - centerX) / (rect.width / 2);
      const dy = (e.clientY - centerY) / (rect.height / 2);
      setEyeOffset({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
    });
  }, []);

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
  const [chatMoodPending, setChatMoodPending] = useState(false);
  const [chatNamePending, setChatNamePending] = useState(false);
  const [pendingPetName, setPendingPetName] = useState("");
  const [showSpeedChoice, setShowSpeedChoice] = useState(false);
  const speedChoiceShownRef = useRef(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[]; moodPicker?: boolean }>>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectCreatedRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);
  const idleTimerRef = useRef<number>();
  const fallbackTimerRef = useRef<number>();
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

  // Loading state flag (early return moved to JSX to avoid hook ordering issues)
  const isProjectLoading = activeProjectId && projectLoading;

  // Derive phase from project state
  const phase: Phase = !activeProjectId || !project
    ? "home"
    : project.status === "upload" ? "upload"
    : !project.mood ? "mood-picker"
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

  // ─── Idle sleep + startled wake ────────────────────────────
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      if (phase === "generating") return;
      setRabbitState("sleeping");
    }, 2 * 60 * 1000);
  }, [phase]);

  const wakeRabbit = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const currentPhase: Phase = phase;
    setRabbitState(prev => {
      if (prev === "sleeping" && currentPhase !== "generating") {
        setTimeout(() => {
          setRabbitState(() => {
            if (currentPhase === "interview") return "listening";
            if (currentPhase === "review") return "presenting";
            if ((currentPhase === "upload" || currentPhase === "home") && photos.length > 0) return "excited";
            return "idle";
          });
        }, 600);
        return "excited";
      }
      return prev;
    });
    resetIdleTimer();
  }, [phase, photos.length, resetIdleTimer]);

  useEffect(() => {
    resetIdleTimer();
    const onActivity = () => resetIdleTimer();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // ─── Handlers ─────────────────────────────────────────────

  const handlePhotoUpload = async (files: File[]) => {
    let pid = activeProjectId;
    if (!pid && projectCreatedRef.current) {
      // Project is being created — queue these files for upload after creation
      pendingFilesRef.current = [...pendingFilesRef.current, ...files];
      const totalAfter = photos.length + pendingFilesRef.current.length;
      if (totalAfter >= 10) {
        setRabbitState("celebrating");
        setTimeout(() => {
          if (phase === "upload" || phase === "home") setRabbitState("excited");
        }, 1200);
      } else if (totalAfter >= 5) {
        setRabbitState("excited");
      } else {
        setRabbitState("listening");
        setTimeout(() => setRabbitState("excited"), 300);
      }
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
        const totalAfter = photos.length + allFiles.length;
        if (totalAfter >= 10) {
          setRabbitState("celebrating");
          setTimeout(() => {
            if (phase === "upload" || phase === "home") setRabbitState("excited");
          }, 1200);
        } else if (totalAfter >= 5) {
          setRabbitState("excited");
        } else {
          setRabbitState("listening");
          setTimeout(() => setRabbitState("excited"), 300);
        }
        return;
      } catch {
        projectCreatedRef.current = false;
        pendingFilesRef.current = [];
        toast.error("Couldn't start your project — try dropping your photos again.");
        return;
      }
    }
    if (!pid) return;
    uploadBatch(pid, files);
    const totalAfter = photos.length + files.length;
    if (totalAfter >= 10) {
      setRabbitState("celebrating");
      setTimeout(() => {
        if (phase === "upload" || phase === "home") setRabbitState("excited");
      }, 1200);
    } else if (totalAfter >= 5) {
      setRabbitState("excited");
    } else {
      setRabbitState("listening");
      setTimeout(() => setRabbitState("excited"), 300);
    }
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
    prevCanFinish.current = false;
    setChatNamePending(false);
    setChatMoodPending(false);
    setPendingPetName("");
    setShowSpeedChoice(false);
    speedChoiceShownRef.current = false;
  };

  const handleRenameProject = (id: string, newName: string) => {
    updateProject.mutate({ id, pet_name: newName });
  };

  const handleDeleteProject = (id: string) => {
    deleteProject.mutate(id);
    if (activeProjectId === id) {
      setChatMessages([]);
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    resetIdleTimer();
    setQuickReplies([]);

    // Intercept name input before mood picker
    if (chatNamePending) {
      setChatMessages(prev => [...prev, { role: "user", content: text }]);
      setInput("");
      setPendingPetName(text);
      setChatNamePending(false);
      // Now show mood picker
      setChatMoodPending(true);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: `"${text}" — love it! Now, what's the vibe for this book?`,
        moodPicker: true,
      }]);
      scrollToBottom();
      return;
    }

    // ── Intent detection: user says "just make it / go for it / generate" etc. ──
    // If they clearly want to generate NOW and we have photos, honor it immediately.
    // Broad intent detection: catches "make a story", "write me a book", "create it", "generate", "go for it", etc.
    const intentKeywords = /\b(make|create|write|generate|build)\b.{0,40}\b(book|story|pages?|it|this|now)\b|\b(just do it|go for it|let'?s go|make it now|make my book|just start|do it now|just make it|make it please)\b/i;
    if (
      intentKeywords.test(text) &&
      photos.length >= 1 &&
      !isFinishing &&
      (phase === "interview" || phase === "upload" || phase === "mood-picker")
    ) {
      setChatMessages(prev => [...prev, { role: "user", content: text }]);
      setInput("");
      setChatMessages(prev => [...prev, { role: "rabbit", content: "Got it — making it now! ⚡" }]);
      setShowSpeedChoice(false);
      scrollToBottom();
      // Extract mood hint from the user's message text
      const moodHint = /\bfunny|humor|hilarious|laugh\b/i.test(text) ? "funny"
        : /\badventure|epic|wild|thrilling\b/i.test(text) ? "adventure"
        : /\bmemorial|memory|remember|miss\b/i.test(text) ? "memorial"
        : null;
      const moodToUse = moodHint || project?.mood || "heartfelt";

      // Need a mood first if we don't have one
      if (!project?.mood && phase !== "interview") {
        // Don't call startInterview() — it wipes the chat. Set status directly.
        await updateProject.mutateAsync({
          id: activeProjectId!,
          mood: moodToUse,
          pet_name: (project?.pet_name && project.pet_name !== "New Project")
            ? project.pet_name
            : pendingPetName || "New Project",
        });
        await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
        setTimeout(() => handleFinishInterview(true), 300);
      } else {
        handleFinishInterview(true);
      }
      return;
    }

    setChatMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    scrollToBottom();

    if ((phase === "interview" || phase === "generating") && project) {
      const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
      try {
        setRabbitState("thinking");
        await sendMessage(text, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type, project.mood);
      } catch {
        setChatMessages(prev => [...prev, { role: "rabbit", content: "Hmm, something glitched. Try sending that again?" }]);
        scrollToBottom();
      }
    } else if (user && (phase === "home" || phase === "upload" || phase === "mood-picker")) {
      const captionedPhotos = photos.filter(p => p.caption);
      if (captionedPhotos.length > 0 && activeProjectId) {
        // Photos exist with captions — use AI for context-aware response
        const photoCaptions = captionedPhotos.map(p => p.caption as string);
        console.log("[Chat] Sending message in upload phase, projectId:", activeProjectId);
        try {
          setRabbitState("thinking");
          await sendMessage(
            text,
            interviewMessages,
            project?.pet_name || "your subject",
            project?.pet_type || "general",
            photoCaptions,
            project?.photo_context_brief || null,
            project?.product_type || "picture_book",
            project?.mood || "heartfelt"
          );
          console.log("[Chat] sendMessage resolved");
          // Safety net: if no rabbit reply arrives within 8s, show fallback
          fallbackTimerRef.current = window.setTimeout(() => {
            setChatMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === "user") {
                return [...prev, { role: "rabbit" as const, content: "I'm still getting to know your photos! Drop more in or hit 'That's all my photos' when you're ready." }];
              }
              return prev;
            });
            scrollToBottom();
          }, 8000);
        } catch (err) {
          console.error("[Chat] sendMessage failed:", err);
          setChatMessages(prev => [...prev, { role: "rabbit", content: "Hmm, something glitched. Try that again?" }]);
          setRabbitState("listening");
          scrollToBottom();
        }
      } else {
        // No photos yet — use canned responses
        const earlyResponses = [
          "Drop some photos and I'll show you what I can do!",
          "I'm ready to paint — just need some photos to work with.",
          "Got something good? Drag your photos in and let's make a book.",
          "The more photos you give me, the better the story. Drop 'em in!",
        ];
        const idx = chatMessages.filter(m => m.role === "rabbit").length % earlyResponses.length;
        setTimeout(() => {
          setChatMessages(prev => [...prev, { role: "rabbit", content: earlyResponses[idx] }]);
          scrollToBottom();
        }, 500);
      }
    }
  };

  useEffect(() => {
    if (lastFinishedContent) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = undefined;
      }
      setChatMessages(prev => [...prev, { role: "rabbit", content: lastFinishedContent }]);
      setRabbitState(phase === "generating" ? "painting" : "listening");
      // Only show quick replies during the interview phase
      if (phase === "interview") {
        const replies = getQuickReplies(lastFinishedContent, project?.pet_name || "them", project?.mood);
        setQuickReplies(replies);
      }
      scrollToBottom();
    }
  }, [lastFinishedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear quick replies while streaming
  useEffect(() => {
    if (isStreaming) setQuickReplies([]);
  }, [isStreaming]);

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
    if (!activeProjectId) return;
    if (updateStatus.isPending) return;
    if (!project?.mood) {
      // No mood yet — first ask for the name, then mood
      updateStatus.mutate(
        { id: activeProjectId, status: "interview" },
        {
          onError: (err) => {
            console.error("handleContinueToInterview status update failed:", err);
            toast.error("Couldn't advance to interview — try again");
          },
        }
      );
      setChatNamePending(true);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "Love these! Who's the star of this book? (Type their name)",
      }]);
      scrollToBottom();
      return;
    }
    // Mood already set (returning user) — go straight to interview
    appearanceProfilePromise.current = supabase.functions.invoke("build-appearance-profile", {
      body: { projectId: activeProjectId },
    });
    startInterview(project.mood);
  };

  const handleMoodSelect = async (mood: string, name: string) => {
    if (!activeProjectId) return;
    try {
      await updateProject.mutateAsync({ id: activeProjectId, mood, pet_name: name });
      appearanceProfilePromise.current = supabase.functions.invoke("build-appearance-profile", {
        body: { projectId: activeProjectId },
      });
      startInterview(mood);
    } catch (err) {
      console.error("handleMoodSelect failed:", err);
      toast.error("Couldn't save mood — try again");
    }
  };

  const startInterview = (mood: string) => {
    if (!activeProjectId) return;
    updateStatus.mutate({ id: activeProjectId, status: "interview" });
    setShowSpeedChoice(false);
    speedChoiceShownRef.current = false;

    // Read rabbit memory
    let memoryGreeting = "";
    try {
      const raw = localStorage.getItem("photorabbit_last_book");
      if (raw) {
        const mem = JSON.parse(raw);
        if (mem.petName && mem.petName !== project?.pet_name) {
          memoryGreeting = `Last time we made a book about ${mem.petName}. `;
        } else if (mem.petName && mem.petName === project?.pet_name) {
          memoryGreeting = `Back for another ${mem.petName} book? I love it. `;
        }
      }
    } catch { /* ignore */ }

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
    greeting = memoryGreeting + greeting;
    setChatMessages([{ role: "rabbit", content: greeting }]);
    setRabbitState("listening");
    scrollToBottom();
  };

  const handleFinishInterview = async (skipNameCheck = false) => {
    if (!activeProjectId || isFinishing) return;

    // Name fallback: if the project still has the default name, ask for it first
    // (skipped when coming from the quick-intent path, where the user's message itself is the brief)
    if (!skipNameCheck && (!project?.pet_name || project.pet_name === "New Project")) {
      setChatNamePending(true);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "One quick thing — what's the name for the star of this book?",
      }]);
      scrollToBottom();
      return;
    }

    setIsFinishing(true);

    try {
    // Dev mode: skip credit check entirely
    if (isDevMode()) {
      await updateStatus.mutateAsync({ id: activeProjectId, status: "generating" });
      return;
    }

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

    setShowCreditGate(false);

    // Wait for appearance profile to finish before generating
    if (appearanceProfilePromise.current) {
      await appearanceProfilePromise.current.catch(() => {});
      appearanceProfilePromise.current = null;
    }

    // Set status to generating FIRST (before deducting credit)
    try {
      await updateStatus.mutateAsync({ id: activeProjectId, status: "generating" });
    } catch {
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "Something went wrong starting the generation. Your credit is safe — try again?",
      }]);
      scrollToBottom();
      return;
    }

    // Status updated successfully — NOW deduct credit
    const success = await deduct(activeProjectId, "Book generation");
    if (!success) {
      // Roll back status
      updateStatus.mutate({ id: activeProjectId, status: "interview" });
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "Something went wrong with credits. Try again?",
      }]);
      scrollToBottom();
      return;
    }
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `I have everything I need. Watch this — I'm going to paint ${project?.pet_name || "your"} book! Keep chatting while I work.`,
    }]);
    } finally {
      setIsFinishing(false);
    }
  };

  // Quick-generate: bypass the 4-message gate, fire immediately from photos alone
  const handleQuickGenerate = async () => {
    setShowSpeedChoice(false);
    if (!project?.mood) {
      // No mood yet (upload phase) — default to heartfelt and go
      const nameToUse = (project?.pet_name && project.pet_name !== "New Project")
        ? project.pet_name
        : pendingPetName || "your subject";
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: `I've got everything I need from your photos. Making it now! ⚡`,
      }]);
      scrollToBottom();
      await updateProject.mutateAsync({ id: activeProjectId!, mood: "heartfelt", pet_name: nameToUse });
      startInterview("heartfelt");
      setTimeout(() => handleFinishInterview(), 300);
    } else {
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: `I've studied every photo. I've got ${project?.pet_name || "this"}. Watch me go! ⚡`,
      }]);
      scrollToBottom();
      handleFinishInterview();
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
        const { data, error } = await supabase.functions.invoke("create-share-link", {
          body: { projectId: activeProjectId },
        });
        if (error) {
          console.error("create-share-link edge function error:", error);
        } else if (data?.error) {
          console.error("create-share-link returned error:", data.error);
        } else if (data?.shareToken) {
          const url = `${window.location.origin}/book/${data.shareToken}`;
          shareMsg = `Your book is ready! Share it with anyone: ${url}`;
        }
      } catch (e) {
        console.error("create-share-link failed:", e);
      }
    }
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: shareMsg,
    }]);
    setRabbitState("presenting");
    scrollToBottom();

    // Save rabbit memory
    try {
      const memory = {
        petName: project?.pet_name || "your subject",
        petType: project?.pet_type,
        mood: project?.mood,
        timestamp: Date.now(),
      };
      localStorage.setItem("photorabbit_last_book", JSON.stringify(memory));
    } catch { /* incognito/quota — ignore */ }
  };

  const handleBackFromReview = () => {
    if (activeProjectId) {
      updateStatus.mutate({ id: activeProjectId, status: "interview" });
    }
  };

  const userInterviewCount = interviewMessages.filter(m => m.role === "user").length;
  const canFinish = userInterviewCount >= 4;

  // Signal when canFinish becomes true — rabbit hints that the "Make my book" button is ready
  const prevCanFinish = useRef(false);
  useEffect(() => {
    if (canFinish && !prevCanFinish.current && phase === "interview") {
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: "I have enough to start — hit \"Make my book\" whenever you're ready. Or keep sharing for an even richer story!",
      }]);
      scrollToBottom();
    }
    prevCanFinish.current = canFinish;
  }, [canFinish, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show speed-choice sticky banner as soon as user has photos — works in BOTH upload and interview phase.
  // Fires regardless of how many messages the user has sent. Resets when switching projects.
  useEffect(() => {
    if (phase !== "interview" && phase !== "upload") return;
    if (photos.length === 0) return;
    if (speedChoiceShownRef.current) return;
    speedChoiceShownRef.current = true;
    setShowSpeedChoice(true);
  }, [phase, photos.length]);

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

  // One-time greeting injection per project load (no auto-updating)
  const greetingInjectedRef = useRef<string | null>(null);
  useEffect(() => {
    // Only inject once per project
    if (!project) return;
    if (chatMessages.length > 0) return;
    if (greetingInjectedRef.current === (activeProjectId || "")) return;
    greetingInjectedRef.current = activeProjectId || "";

    let greeting: string;
    if (phase === "interview" && project.mood) {
      const greetings = photos.length <= 3 ? shortGreetings : fullGreetings;
      greeting = greetings[project.mood] || greetings.heartfelt;
    } else if (phase === "mood-picker") {
      greeting = "Nice photos! Before we dive in — what's the vibe for this book?";
    } else if (phase === "generating") {
      greeting = "I'm painting your book right now — watch the progress on the right!";
    } else if (phase === "review") {
      greeting = "Your book is ready! Review it on the right, then share it with anyone.";
    } else if (photos.length > 0) {
      // Photos exist — if name is still default, ask for it right away
      if (!project.pet_name || project.pet_name === "New Project") {
        setChatNamePending(true);
        greeting = `I see ${photos.length} photo${photos.length !== 1 ? "s" : ""}! First — who's the star of this book?`;
      } else {
        greeting = `${photos.length} photo${photos.length !== 1 ? "s" : ""} loaded. Ready when you are!`;
      }
    } else {
      greeting = "Ready when you are — drop some photos and let's get started.";
    }
    setChatMessages([{ role: "rabbit", content: greeting }]);
    scrollToBottom();
  }, [project, activeProjectId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset greeting ref when switching projects
  useEffect(() => {
    greetingInjectedRef.current = null;
  }, [activeProjectId]);

  // Reactively update the first greeting when photos arrive or get captioned
  const prevPhotoCountRef = useRef(0);
  useEffect(() => {
    if (phase !== "upload" && phase !== "home") return;
    if (photos.length === 0) return;
    // Only update if photo count changed (new photos arrived)
    if (photos.length === prevPhotoCountRef.current) {
      // Check if captions just arrived (describe-photo completed)
      const captioned = photos.filter(p => p.caption);
      if (captioned.length > 0 && chatMessages.length >= 1 && chatMessages[0].role === "rabbit" && !chatMessages[0].photos && !chatMessages[0].moodPicker) {
        const firstCaption = captioned[0].caption!;
        const snippet = firstCaption.length > 60 ? firstCaption.slice(0, 60).replace(/\s+\S*$/, "") + "..." : firstCaption;
        const newGreeting = photos.length < 3
          ? `I see: "${snippet}" — add more photos for a richer story, or continue when you're ready.`
          : `${photos.length} photos! I can see "${snippet}" and more. Ready when you are.`;
        // Only update if different
        if (chatMessages[0].content !== newGreeting) {
          setChatMessages(prev => [{ role: "rabbit", content: newGreeting }, ...prev.slice(1)]);
        }
      }
      return;
    }
    prevPhotoCountRef.current = photos.length;
    // Photos arrived — update the first message
    if (chatMessages.length >= 1 && chatMessages[0].role === "rabbit" && !chatMessages[0].photos && !chatMessages[0].moodPicker) {
      const captioned = photos.filter(p => p.caption);
      let newGreeting: string;
      if (captioned.length > 0) {
        const firstCaption = captioned[0].caption!;
        const snippet = firstCaption.length > 60 ? firstCaption.slice(0, 60).replace(/\s+\S*$/, "") + "..." : firstCaption;
        newGreeting = photos.length < 3
          ? `I see: "${snippet}" — add more photos for a richer story, or continue when you're ready.`
          : `${photos.length} photos! I can see "${snippet}" and more. Ready when you are.`;
      } else if (isBatchUploading) {
        newGreeting = "I'm studying your photos right now...";
      } else {
        newGreeting = `${photos.length} photo${photos.length !== 1 ? "s" : ""} — still reading them. Ready when you are.`;
      }
      setChatMessages(prev => [{ role: "rabbit", content: newGreeting }, ...prev.slice(1)]);
      scrollToBottom();
    }
  }, [photos, phase, isBatchUploading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Instant magic: generate preview illustration once captions arrive ───
  const previewTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "upload" && phase !== "home") return;
    if (!activeProjectId) return;
    if (previewTriggeredRef.current === activeProjectId) return;
    const captioned = photos.filter(p => p.caption);
    if (captioned.length === 0) return;
    // Trigger once per project
    previewTriggeredRef.current = activeProjectId;
    const generatePreview = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("generate-preview-illustration", {
          body: { projectId: activeProjectId },
        });
        if (error || !data?.publicUrl) {
          console.warn("Preview illustration failed:", error || "no URL");
          return;
        }
        setChatMessages(prev => {
          // Dedup guard — never add a second preview image message
          if (prev.some(m => m.role === "rabbit" && m.photos?.length)) return prev;
          return [...prev, {
            role: "rabbit" as const,
            content: "Here's a little taste of what your book could look like... ✨",
            photos: [data.publicUrl],
          }];
        });
        setRabbitState("celebrating");
        setTimeout(() => setRabbitState("excited"), 1500);
        scrollToBottom();
      } catch (err) {
        console.warn("Preview illustration error:", err);
      }
    };
    generatePreview();
  }, [photos, phase, activeProjectId, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recover mood picker if phase is mood-picker but no picker in chat
  useEffect(() => {
    if (phase !== "mood-picker") return;
    if (chatMoodPending) return;
    const hasMoodPicker = chatMessages.some(m => m.moodPicker);
    if (hasMoodPicker) return;
    setChatMoodPending(true);
    setChatMessages(prev => [...prev, {
      role: "rabbit" as const,
      content: "Nice photos! Before we dive in — what's the vibe for this book?",
      moodPicker: true,
    }]);
    scrollToBottom();
  }, [phase, chatMoodPending, chatMessages, scrollToBottom]);

  // ─── Chat panel content (used for both layouts) ─────────
  const chatPanel = (
    <div ref={chatPanelRef} onMouseMove={handleMouseMove} className={isMobile ? "flex flex-col flex-1 min-h-0" : "workspace-chat"}>
      {/* Rabbit — smaller in split layout */}
      <div className="flex justify-center pt-4 pb-2 shrink-0">
        <RabbitCharacter state={rabbitState} size={isMobile ? 120 : 80} eyeOffset={eyeOffset} mood={project?.mood} />
      </div>

      {/* Chat scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 space-y-5 pb-4">
        {/* Greeting is now injected into chatMessages — no static element */}

        {/* Interview + generating chat messages */}
        {user && (phase === "interview" || phase === "generating" || phase === "review" || phase === "home" || phase === "upload" || phase === "mood-picker") && (
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
                    {msg.moodPicker && chatMoodPending ? (
                      <ChatMessage role={msg.role} content="">
                        <div className="space-y-3">
                          <div className="px-4 py-3 text-[15px] leading-relaxed font-body whitespace-pre-line rounded-2xl rounded-bl-md bg-[hsl(var(--chat-ai-bg))] text-[hsl(var(--chat-ai-text))] border border-[hsl(var(--chat-ai-border))] shadow-chat">
                            {msg.content}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { mood: "funny", label: "😂 Funny" },
                              { mood: "heartfelt", label: "💛 Heartfelt" },
                              { mood: "adventure", label: "🗺️ Adventure" },
                              { mood: "memorial", label: "🕊️ Memorial" },
                            ].map(({ mood, label }) => (
                              <button
                                key={mood}
                                onClick={() => {
                                  setChatMoodPending(false);
                                  setChatMessages(prev => [...prev, { role: "user", content: label }]);
                                  handleMoodSelect(mood, pendingPetName || project?.pet_name || "New Project");
                                }}
                                className="px-4 py-2 rounded-full text-sm font-body font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20 hover:border-primary shadow-sm"
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </ChatMessage>
                    ) : (
                      <ChatMessage role={msg.role} content={msg.content} photos={msg.photos} />
                    )}
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

      {/* Speed-choice sticky bar — visible in upload OR interview phase as soon as user has photos */}
      <AnimatePresence>
        {showSpeedChoice && (phase === "interview" || phase === "upload") && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3 }}
            className="flex gap-2 flex-wrap px-4 py-2.5 border-t border-border/40 bg-background/90 backdrop-blur-sm shrink-0"
          >
            <button
              onClick={handleQuickGenerate}
              className="px-4 py-2 rounded-full text-sm font-body font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              ⚡ Make it now — let AI decide
            </button>
            <button
              onClick={() => setShowSpeedChoice(false)}
              className="px-4 py-2 rounded-full text-sm font-body font-medium bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors border border-border shadow-sm"
            >
              💬 Tell me first
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-reply chips — pinned above input during interview, hidden while streaming or typing */}
      <AnimatePresence>
        {phase === "interview" && quickReplies.length > 0 && !isStreaming && input.length === 0 && (
          <motion.div
            key="quick-replies"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.22 }}
            className="flex flex-wrap gap-2 px-4 py-2.5 shrink-0"
          >
            {quickReplies.map((reply) => {
              const isOwnStory = reply.startsWith("✍️");
              return (
                <motion.button
                  key={reply}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    if (isOwnStory) {
                      // Just focus the input — let user type their own story
                      setQuickReplies([]);
                      setTimeout(() => {
                        const inputEl = document.querySelector<HTMLInputElement>('[aria-label="Type a message"]');
                        inputEl?.focus();
                      }, 50);
                    } else {
                      // Instant-send: clear chips, set input, then trigger send directly
                      setQuickReplies([]);
                      // Directly invoke send with the chip text
                      const sendChip = async () => {
                        const text = reply.trim();
                        if (!text || !project) return;
                        setChatMessages(prev => [...prev, { role: "user", content: text }]);
                        setInput("");
                        scrollToBottom();
                        if (phase === "interview") {
                          const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
                          try {
                            setRabbitState("thinking");
                            await sendMessage(text, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type, project.mood);
                          } catch {
                            setChatMessages(prev => [...prev, { role: "rabbit", content: "Hmm, something glitched. Try sending that again?" }]);
                            scrollToBottom();
                          }
                        }
                      };
                      sendChip();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-full text-sm font-body font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20 hover:border-primary shadow-sm"
                >
                  {reply}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat input — always visible */}
      <ChatInput
        value={input}
        onChange={(val) => {
          setInput(val);
          if (val.length > 0) setQuickReplies([]);
        }}
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
        allowQuickFinish={showSpeedChoice && userInterviewCount === 0}
        userInterviewCount={userInterviewCount}
        onFinishInterview={handleFinishInterview}
        isFinishing={isFinishing}
        activeProjectId={activeProjectId}
        onGenerationComplete={handleGenerationComplete}
        onNewIllustration={handleNewIllustration}
        interviewHighlights={interviewHighlights}
        mood={project?.mood}
        onBackFromReview={handleBackFromReview}
        dbStatus={project?.status}
      />
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────
  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      onMouseDown={wakeRabbit}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (files.length > 0) handlePhotoUpload(files);
      }}
    >
      {isProjectLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
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

      {/* Project shelf */}
      <ProjectShelf
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={handleSelectProject}
        onNew={handleNewProject}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
      />

        </>
      )}
    </div>
  );
};

export default PhotoRabbit;
