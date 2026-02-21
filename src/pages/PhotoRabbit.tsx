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
import { useAuth, useCredits, TOKEN_COSTS } from "@/hooks/useAuth";
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
  const { sendMessage, isStreaming, streamingContent, lastFinishedContent, lastSuggestedReplies, lastDetectedMood } = useInterviewChat(activeProjectId || undefined);
  const createProject = useCreateMinimalProject();
  const updateStatus = useUpdateProjectStatus();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { uploadBatch, uploadProgress, isBatchUploading, captioningIds } = useUploadPhoto();
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
  // Legacy pending states removed — organic discovery replaces them
  const chatMoodPending = false; // kept as constant for JSX references during migration
  const chatNamePending = false; // kept as constant for JSX references during migration
  const pendingPetName = ""; // kept as constant for references during migration
  const [showSpeedChoice, setShowSpeedChoice] = useState(false);
  const speedChoiceShownRef = useRef(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "rabbit" | "user"; content: string; photos?: string[]; moodPicker?: boolean; projectId?: string }>>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectCreatedRef = useRef(false);
  const pendingFilesRef = useRef<File[]>([]);
  const idleTimerRef = useRef<number>();
  const fallbackTimerRef = useRef<number>();
  // Mobile sandbox collapsed state
  const [mobileSandboxCollapsed, setMobileSandboxCollapsed] = useState(false);
  // Suppress spurious mood-picker auto-recovery when intent path already set a mood
  const suppressMoodPickerRef = useRef(false);

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

  // Unified send function — the ONLY path for sending user text (input box + chip clicks)
  const sendChatMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    if (isStreaming) return;
    const trimmed = text.trim();
    resetIdleTimer();
    setQuickReplies([]);

    // ── Intent detection: user says "just make it / go for it / generate" etc. ──
    const intentKeywords = /\b(make|create|write|generate|build)\b.{0,40}\b(book|story|pages?|it|this|now)\b|\b(just do it|go for it|let'?s go|make it now|make my book|just start|do it now|just make it|make it please)\b/i;
    if (
      intentKeywords.test(trimmed) &&
      photos.length >= 1 &&
      !isFinishing &&
      (phase === "interview" || phase === "upload" || phase === "mood-picker")
    ) {
      setChatMessages(prev => [...prev, { role: "user", content: trimmed }]);
      setInput("");
      setChatMessages(prev => [...prev, { role: "rabbit", content: "Got it — making it now!" }]);
      setShowSpeedChoice(false);
      scrollToBottom();
      const moodHint = /\bfunny|humor|hilarious|laugh\b/i.test(trimmed) ? "funny"
        : /\badventure|epic|wild|thrilling\b/i.test(trimmed) ? "adventure"
        : /\bmemorial|memory|remember|miss\b/i.test(trimmed) ? "memorial"
        : null;
      const moodToUse = moodHint || project?.mood || "heartfelt";

      const nameMatch = trimmed.match(
        /\b(?:of|about|for|starring|featuring)\s+([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+(?:and\b|going|playing|at\b|in\b|the\b)|[,.]|$)/i
      );
      const extractedName = nameMatch?.[1]?.trim();
      const nameToUse = extractedName && extractedName.toLowerCase() !== "new project"
        ? extractedName
        : (project?.pet_name && project.pet_name !== "New Project")
          ? project.pet_name
          : pendingPetName || null;

      if (activeProjectId) {
        await supabase.from("project_interview").insert({
          project_id: activeProjectId,
          role: "user",
          content: trimmed,
        });
        await supabase.from("project_interview").insert({
          project_id: activeProjectId,
          role: "assistant",
          content: `Got it! I'll make a ${moodToUse} book${nameToUse ? ` about ${nameToUse}` : ""}.`,
        });
      }

      if (!project?.mood && phase !== "interview") {
        suppressMoodPickerRef.current = true;
        await updateProject.mutateAsync({
          id: activeProjectId!,
          mood: moodToUse,
          pet_name: nameToUse || "New Project",
        });
        await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
        setTimeout(() => handleFinishInterview(true), 800);
      } else {
        if (nameToUse && nameToUse !== project?.pet_name) {
          await updateProject.mutateAsync({ id: activeProjectId!, pet_name: nameToUse });
        }
        handleFinishInterview(true);
      }
      return;
    }

    setChatMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    scrollToBottom();

    if ((phase === "interview" || phase === "generating") && project) {
      const photoCaptions = photos.filter(p => p.caption).map(p => p.caption as string);
      setRabbitState("thinking");
      // Brief anticipatory message (replaced by real stream within 1-2s)
      setChatMessages(prev => [...prev, { role: "rabbit" as const, content: "Hmm, let me think about that..." }]);
      scrollToBottom();
      await sendMessage(trimmed, interviewMessages, project.pet_name, project.pet_type, photoCaptions, project.photo_context_brief, project.product_type, project.mood);
    } else if (user && (phase === "home" || phase === "upload" || phase === "mood-picker")) {
      const captionedPhotos = photos.filter(p => p.caption);
      if (captionedPhotos.length > 0 && activeProjectId) {
        const photoCaptions = captionedPhotos.map(p => p.caption as string);
        setRabbitState("thinking");
        // Brief anticipatory message (replaced by real stream within 1-2s)
        setChatMessages(prev => [...prev, { role: "rabbit" as const, content: "Hmm, let me think about that..." }]);
        scrollToBottom();
        await sendMessage(
          trimmed,
          interviewMessages,
          project?.pet_name || "your subject",
          project?.pet_type || "general",
          photoCaptions,
          project?.photo_context_brief || null,
          project?.product_type || "picture_book",
          project?.mood || "heartfelt"
        );
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
      } else {
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
  }, [isStreaming, chatNamePending, phase, photos, project, activeProjectId, isFinishing, interviewMessages, user, chatMessages.length, pendingPetName, resetIdleTimer, scrollToBottom, sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => sendChatMessage(input);

  useEffect(() => {
    if (lastFinishedContent) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = undefined;
      }
      // Remove anticipatory "thinking" message if present
      setChatMessages(prev => {
        const filtered = prev.filter(m => m.content !== "Hmm, let me think about that...");
        return [...filtered, { role: "rabbit", content: lastFinishedContent }];
      });
      setRabbitState(phase === "generating" ? "painting" : "listening");
      // Show AI-generated quick replies during interview, fall back to static if none
      if (phase === "interview") {
        if (lastSuggestedReplies.length > 0) {
          setQuickReplies(lastSuggestedReplies);
        } else {
          const replies = getQuickReplies(lastFinishedContent, project?.pet_name || "them", project?.mood);
          setQuickReplies(replies);
        }
      }
      scrollToBottom();
    }
  }, [lastFinishedContent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update project mood when LLM detects a shift
  useEffect(() => {
    if (!lastDetectedMood || !activeProjectId) return;
    if (lastDetectedMood === project?.mood) return;
    updateProject.mutate({ id: activeProjectId, mood: lastDetectedMood });
  }, [lastDetectedMood]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isFinishing) return;
    // Default mood = heartfelt. The LLM will detect and shift mood during conversation.
    const moodToUse = project?.mood || "heartfelt";
    if (!project?.mood) {
      // Auto-set mood so phase transitions cleanly
      suppressMoodPickerRef.current = true;
      updateProject.mutate({ id: activeProjectId, mood: moodToUse });
    }
    // Auto-extract name from photo analysis if still default
    if (!project?.pet_name || project.pet_name === "New Project") {
      const captioned = photos.filter(p => p.ai_analysis || p.caption);
      if (captioned.length > 0) {
        const analysis = (captioned[0] as any).ai_analysis;
        const extractedName = analysis?.people_present?.[0] || analysis?.subject_name;
        if (extractedName) {
          updateProject.mutate({ id: activeProjectId, pet_name: extractedName });
        }
      }
    }
    appearanceProfilePromise.current = supabase.functions.invoke("build-appearance-profile", {
      body: { projectId: activeProjectId },
    });
    startInterview(moodToUse);
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
    // Non-destructive: only inject greeting if chat is empty — never wipe existing history
    setChatMessages(prev => {
      if (prev.length > 0) return prev;
      return [{ role: "rabbit", content: greeting }];
    });
    // Immediately compute and show chips for the first rabbit question
    const initialReplies = getQuickReplies(greeting, project?.pet_name || "them", mood);
    setQuickReplies(initialReplies);
    setRabbitState("listening");
    scrollToBottom();
  };

  const handleFinishInterview = async (skipNameCheck = false) => {
    if (!activeProjectId || isFinishing) return;

    // Name fallback: if the project still has the default name, ask for it first
    // (skipped when coming from the quick-intent path, where the user's message itself is the brief)
    if (!skipNameCheck && (!project?.pet_name || project.pet_name === "New Project")) {
      // Auto-set a fallback name instead of blocking generation
      const fallbackName = "Your Story";
      await supabase.from("projects").update({ pet_name: fallbackName }).eq("id", activeProjectId);
    }

    setIsFinishing(true);

    try {
    // Ensure product_type is written to DB before generation (safety net)
    await updateProject.mutateAsync({ id: activeProjectId, product_type: productType });

    // Dev mode: skip credit check entirely
    if (isDevMode()) {
      await updateStatus.mutateAsync({ id: activeProjectId, status: "generating" });
      return;
    }

    // Credit check before generation — variable cost based on product type
    const tokenCost = TOKEN_COSTS[productType] || 5;
    const currentBalance = await fetchBalance();
    if (currentBalance < tokenCost) {
      setShowCreditGate(true);
      setChatMessages(prev => [...prev, {
        role: "rabbit",
        content: currentBalance === 0
          ? `I need ${tokenCost} token${tokenCost !== 1 ? "s" : ""} for this. Let's get that sorted first!`
          : `This needs ${tokenCost} tokens but you have ${currentBalance}. Let's get more!`,
      }]);
      scrollToBottom();
      return;
    }

    setShowCreditGate(false);

    // Wait for appearance profile to finish before generating
    if (appearanceProfilePromise.current) {
      setChatMessages(prev => [...prev, {
        role: "rabbit" as const,
        content: "Finishing up my study of your photos...",
      }]);
      scrollToBottom();
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

    // Status updated successfully — NOW deduct tokens
    const productLabel = productType === "single_illustration" ? "Single illustration"
      : productType === "short_story" ? "Short story"
      : "Picture book";
    const success = await deduct(activeProjectId, `${productLabel} generation`, tokenCost);
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
      // Suppress mood-picker auto-recovery during the brief DB refetch window
      suppressMoodPickerRef.current = true;
      await updateProject.mutateAsync({ id: activeProjectId!, mood: "heartfelt", pet_name: nameToUse });
      await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
      setTimeout(() => handleFinishInterview(true), 800);
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
  const localUserCount = chatMessages.filter(m => m.role === "user").length;
  const displayCount = Math.max(userInterviewCount, localUserCount);

  // Derive product type from photo count: 1 = single illustration, 2-5 = short story, 6+ = full book
  const productType: "single_illustration" | "short_story" | "picture_book" =
    photos.length <= 1 ? "single_illustration"
    : photos.length <= 5 ? "short_story"
    : "picture_book";

  // Adaptive canFinish threshold based on product type
  const canFinishThreshold = productType === "single_illustration" ? 1
    : productType === "short_story" ? 2
    : 4;
  const canFinish = displayCount >= canFinishThreshold;

  // Sync product_type to project whenever it changes (null init forces first-render write)
  const prevProductTypeRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeProjectId) return;
    if (productType === prevProductTypeRef.current) return;
    prevProductTypeRef.current = productType;
    updateProject.mutate({ id: activeProjectId, product_type: productType });
  }, [productType, activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track canFinish for sandbox button — no system message injection (button guides the user)
  const prevCanFinish = useRef(false);
  useEffect(() => {
    prevCanFinish.current = canFinish;
  }, [canFinish]);

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
      greeting = `${photos.length} photo${photos.length !== 1 ? "s" : ""} loaded. Ready when you are!`;
    } else {
      greeting = "Ready when you are — drop some photos and let's get started.";
    }
    setChatMessages([{ role: "rabbit", content: greeting }]);
    scrollToBottom();
  }, [project, activeProjectId, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset greeting ref when switching projects
  useEffect(() => {
    greetingInjectedRef.current = null;
    previewTriggeredRef.current = null;   // Reset so new project gets a fresh preview
    prevPhotoCountRef.current = 0;         // Reset photo count so greeting updates correctly
  }, [activeProjectId]);

  // Append new messages when photos arrive — never mutate existing messages
  const prevPhotoCountRef = useRef(0);
  useEffect(() => {
    if (phase !== "upload" && phase !== "home") return;
    if (photos.length === 0) return;
    if (photos.length === prevPhotoCountRef.current) return;
    const prevCount = prevPhotoCountRef.current;
    prevPhotoCountRef.current = photos.length;
    // Only append a new message when photos arrive (not on initial load which has greeting)
    if (prevCount === 0) return;
    const newCount = photos.length - prevCount;
    if (newCount > 0) {
      setChatMessages(prev => [...prev, {
        role: "rabbit" as const,
        content: newCount === 1
          ? "Got it! Drop more or continue when ready."
          : `${newCount} more photos! Looking good.`,
      }]);
      scrollToBottom();
    }
  }, [photos.length, phase, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rabbit message during photo captioning
  const prevCaptioningCountRef = useRef(0);
  useEffect(() => {
    const count = captioningIds.size;
    if (count > 0 && prevCaptioningCountRef.current === 0) {
      // Captioning started
      setChatMessages(prev => [...prev, {
        role: "rabbit" as const,
        content: `Studying your photos${count > 1 ? ` (${count} to go)...` : "..."}`,
      }]);
      scrollToBottom();
    } else if (count === 0 && prevCaptioningCountRef.current > 0) {
      // Captioning finished
      setChatMessages(prev => [...prev, {
        role: "rabbit" as const,
        content: "Done studying! I know them well now.",
      }]);
      scrollToBottom();
    } else if (count > 0 && count !== prevCaptioningCountRef.current) {
      // Update count
      const done = prevCaptioningCountRef.current > count ? prevCaptioningCountRef.current - count : 0;
      if (done > 0) {
        setChatMessages(prev => {
          // Update the last captioning message instead of adding a new one
          let lastIdx = -1;
          for (let i = prev.length - 1; i >= 0; i--) {
            if (prev[i].role === "rabbit" && prev[i].content.includes("Studying")) {
              lastIdx = i;
              break;
            }
          }
          if (lastIdx >= 0) {
            const updated = [...prev];
            updated[lastIdx] = { ...updated[lastIdx], content: `Studying your photos... (${count} left)` };
            return updated;
          }
          return prev;
        });
      }
    }
    prevCaptioningCountRef.current = count;
  }, [captioningIds.size, scrollToBottom]);

  // ─── Instant magic: generate preview illustration once captions arrive ───
  const previewTriggeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "upload" && phase !== "home") return;
    if (!activeProjectId) return;
    if (previewTriggeredRef.current === activeProjectId) return;
    const captioned = photos.filter(p => p.caption);
    if (captioned.length === 0) return;
    // Trigger once per project — capture projectId at call time to avoid stale closures
    previewTriggeredRef.current = activeProjectId;
    const capturedProjectId = activeProjectId;
    const generatePreview = async () => {
      // Add loading message
      setChatMessages(prev => [...prev, {
        role: "rabbit" as const,
        content: "Let me sketch something for you...",
      }]);
      scrollToBottom();
      setRabbitState("painting");

      try {
        const { data, error } = await supabase.functions.invoke("generate-preview-illustration", {
          body: { projectId: capturedProjectId },
        });
        if (error || !data?.publicUrl) {
          console.warn("Preview illustration failed:", error || "no URL");
          // Graceful failure message
          setChatMessages(prev => [...prev, {
            role: "rabbit" as const,
            content: "I'll save the sketching for the full book — tell me about them first!",
          }]);
          setRabbitState("excited");
          return;
        }
        setChatMessages(prev => {
          // Dedup guard — scoped to THIS project only, so switching projects never shows stale previews
          if (prev.some(m => m.role === "rabbit" && m.photos?.length && (m as { projectId?: string }).projectId === capturedProjectId)) return prev;
          return [...prev, {
            role: "rabbit" as const,
            content: "Here's a little taste of what your book could look like... ✨",
            photos: [data.publicUrl],
            projectId: capturedProjectId,
          }];
        });
        setRabbitState("celebrating");
        setTimeout(() => setRabbitState("excited"), 1500);
        scrollToBottom();
      } catch (err) {
        console.warn("Preview illustration error:", err);
        // Graceful failure message
        setChatMessages(prev => [...prev, {
          role: "rabbit" as const,
          content: "I'll save the sketching for the full book — tell me about them first!",
        }]);
        setRabbitState("excited");
      }
    };
    generatePreview();
  }, [photos, phase, activeProjectId, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-recover mood-picker phase: if project has no mood, auto-set heartfelt and advance
  useEffect(() => {
    if (phase !== "mood-picker") return;
    if (suppressMoodPickerRef.current) { suppressMoodPickerRef.current = false; return; }
    // Instead of showing mood picker in chat, auto-set default mood and advance
    if (activeProjectId && !project?.mood) {
      suppressMoodPickerRef.current = true;
      updateProject.mutate({ id: activeProjectId, mood: "heartfelt" });
    }
  }, [phase, activeProjectId, project?.mood]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Chat panel content (used for both layouts) ─────────
  const chatPanel = (
    <div ref={chatPanelRef} onMouseMove={handleMouseMove} className={isMobile ? "flex flex-col flex-1 min-h-0" : "workspace-chat"}>
      {/* Rabbit — smaller in split layout */}
      <div className="flex justify-center pt-4 pb-2 shrink-0">
        <RabbitCharacter state={rabbitState} size={isMobile ? 120 : 80} eyeOffset={eyeOffset} mood={project?.mood} />
      </div>

      {/* Step progress indicator — pinned below rabbit, only during interview after 1st user msg */}
      <AnimatePresence>
        {(phase === "interview" || phase === "upload") && displayCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="shrink-0 px-4 py-1.5 flex items-center gap-2.5"
          >
            <div className="flex gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                    i < displayCount ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground font-body">
              {displayCount < 4
                ? "Share more for a richer story"
                : displayCount < 7
                ? "Going great — rabbit is hooked"
                : "Ready · hit Make My Book anytime"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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

            {!isStreaming && rabbitState === "thinking" && (
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
                tokenCost={TOKEN_COSTS[productType] || 5}
                productLabel={productType === "single_illustration" ? "illustration" : productType === "short_story" ? "short story" : "picture book"}
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
              const isOwnStory = reply.startsWith("✍️") || reply.toLowerCase() === "tell my own story";
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
                        const inputEl = document.querySelector<HTMLTextAreaElement>('[aria-label="Type a message"]');
                        inputEl?.focus();
                      }, 50);
                    } else {
                      // Use unified send path
                      sendChatMessage(reply);
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
        captioningIds={captioningIds}
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
        productType={productType}
        tokenCost={TOKEN_COSTS[productType] || 5}
        creditBalance={balance}
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
