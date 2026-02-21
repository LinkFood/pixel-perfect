import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { linkInterviewSeed } from "@/data/linkInterviewSeed";
import { catInterviewSeed } from "@/data/catInterviewSeed";
import { shortInterviewSeed } from "@/data/shortInterviewSeed";

export type SeedOption = "link" | "luna" | "max";

const seedData: Record<SeedOption, { data: { role: string; content: string }[]; label: string; count: number }> = {
  link: { data: linkInterviewSeed, label: "Link (full)", count: linkInterviewSeed.length },
  luna: { data: catInterviewSeed, label: "Luna (cat)", count: catInterviewSeed.length },
  max: { data: shortInterviewSeed, label: "Max (short)", count: shortInterviewSeed.length },
};

export type InterviewMessage = {
  id: string;
  project_id: string;
  role: string;
  content: string;
  created_at: string;
};

export const useInterviewMessages = (projectId: string | undefined) => {
  return useQuery({
    queryKey: ["interview", projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const { data, error } = await supabase
        .from("project_interview")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as InterviewMessage[];
    },
    enabled: !!projectId,
  });
};

export const useClearInterview = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("No project ID");
      const { error } = await supabase
        .from("project_interview")
        .delete()
        .eq("project_id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interview", projectId] });
      toast.success("Interview cleared — start fresh!");
    },
    onError: () => {
      toast.error("Failed to clear interview");
    },
  });
};

export const useAutoFillInterview = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (seed: SeedOption = "link") => {
      if (!projectId) throw new Error("No project ID");
      const { data: messages } = seedData[seed];

      // Clear existing messages
      const { error: delErr } = await supabase
        .from("project_interview")
        .delete()
        .eq("project_id", projectId);
      if (delErr) throw delErr;

      // Insert in batches of 20 with sequential timestamps
      const baseTime = new Date("2025-01-01T00:00:00Z").getTime();
      for (let i = 0; i < messages.length; i += 20) {
        const batch = messages.slice(i, i + 20).map((msg, j) => ({
          project_id: projectId,
          role: msg.role,
          content: msg.content,
          created_at: new Date(baseTime + (i + j) * 1000).toISOString(),
        }));
        const { error } = await supabase.from("project_interview").insert(batch);
        if (error) throw error;
      }

      return seed;
    },
    onSuccess: (seed) => {
      queryClient.invalidateQueries({ queryKey: ["interview", projectId] });
      const info = seedData[seed || "link"];
      toast.success(`${info.label} interview restored! (${info.count} messages)`);
    },
    onError: () => {
      toast.error("Failed to auto-fill interview");
    },
  });
};

/** Parse the ---CHIPS--- and ---MOOD--- delimiters from LLM output. */
function parseChipsAndMood(raw: string): [string, string[], string | null] {
  let content = raw;
  let detectedMood: string | null = null;

  // Extract ---MOOD--- (may appear after chips)
  const moodIdx = content.indexOf("---MOOD---");
  if (moodIdx !== -1) {
    const moodBlock = content.slice(moodIdx + "---MOOD---".length).trim();
    const moodLine = moodBlock.split("\n")[0]?.trim().toLowerCase();
    if (["funny", "heartfelt", "adventure", "memorial"].includes(moodLine)) {
      detectedMood = moodLine;
    }
    content = content.slice(0, moodIdx).trimEnd();
  }

  // Extract ---CHIPS---
  const chipIdx = content.indexOf("---CHIPS---");
  if (chipIdx === -1) return [content, [], detectedMood];
  const message = content.slice(0, chipIdx).trimEnd();
  const chipBlock = content.slice(chipIdx + "---CHIPS---".length).trim();
  const chips = chipBlock.split("\n").map(l => l.trim()).filter(l => l.length > 0 && l.length <= 60).slice(0, 3);
  return [message, chips, detectedMood];
}

export const useInterviewChat = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastFinishedContent, setLastFinishedContent] = useState("");
  const [lastSuggestedReplies, setLastSuggestedReplies] = useState<string[]>([]);
  const [lastDetectedMood, setLastDetectedMood] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    userMessage: string,
    existingMessages: InterviewMessage[],
    petName: string,
    petType: string,
    photoCaptions?: string[],
    photoContextBrief?: string | null,
    productType?: string | null,
    mood?: string | null,
  ) => {
    if (!projectId) return;
    setIsStreaming(true);
    setStreamingContent("");
    setLastFinishedContent("");

    // Save user message
    const { error: saveErr } = await supabase
      .from("project_interview")
      .insert({ project_id: projectId, role: "user", content: userMessage });
    if (saveErr) { toast.error("Failed to save message"); setIsStreaming(false); return; }

    queryClient.invalidateQueries({ queryKey: ["interview", projectId] });

    // Build full message list — server handles windowing with gap explanation
    const allMessages = existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    allMessages.push({ role: "user", content: userMessage });

    const userMessageCount = allMessages.filter(m => m.role === "user").length;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          petName,
          petType,
          userMessageCount,
          photoCaptions,
          ...(photoContextBrief ? { photoContextBrief } : {}),
          ...(productType ? { productType } : {}),
          ...(mood ? { mood } : {}),
        }),
      });

      if (resp.status === 429) { toast.error("Too many requests — please wait a moment"); setIsStreaming(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); setIsStreaming(false); return; }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              // Strip chips from streaming display so user doesn't see raw delimiter
              const [visibleContent] = parseChipsAndMood(fullContent);
              setStreamingContent(visibleContent);
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      // Parse chips and mood from raw output
      const [messageContent, suggestedReplies, detectedMood] = parseChipsAndMood(fullContent);

      // Save assistant message (without chips)
      if (messageContent) {
        await supabase.from("project_interview").insert({ project_id: projectId, role: "assistant", content: messageContent });
        queryClient.invalidateQueries({ queryKey: ["interview", projectId] });
      }

      // Store finished content and suggested replies BEFORE clearing streaming state
      setLastFinishedContent(messageContent);
      setLastSuggestedReplies(suggestedReplies);
      if (detectedMood) setLastDetectedMood(detectedMood);
    } catch (e) {
      console.error("Interview chat error:", e);
      toast.error("Failed to get AI response");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [projectId, queryClient]);

  return { sendMessage, isStreaming, streamingContent, lastFinishedContent, lastSuggestedReplies, lastDetectedMood };
};
