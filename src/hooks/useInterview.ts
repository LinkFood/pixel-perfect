import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useCallback } from "react";
import { toast } from "sonner";

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

export const useInterviewChat = (projectId: string | undefined) => {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const sendMessage = useCallback(async (userMessage: string, existingMessages: InterviewMessage[], petName: string, petType: string) => {
    if (!projectId) return;
    setIsStreaming(true);
    setStreamingContent("");

    // Save user message
    const { error: saveErr } = await supabase
      .from("project_interview")
      .insert({ project_id: projectId, role: "user", content: userMessage });
    if (saveErr) { toast.error("Failed to save message"); setIsStreaming(false); return; }

    queryClient.invalidateQueries({ queryKey: ["interview", projectId] });

    // Build messages for AI
    const messages = existingMessages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    messages.push({ role: "user", content: userMessage });

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/interview-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages, petName, petType }),
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
            if (content) { fullContent += content; setStreamingContent(fullContent); }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      // Save assistant message
      if (fullContent) {
        await supabase.from("project_interview").insert({ project_id: projectId, role: "assistant", content: fullContent });
        queryClient.invalidateQueries({ queryKey: ["interview", projectId] });
      }
    } catch (e) {
      console.error("Interview chat error:", e);
      toast.error("Failed to get AI response");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [projectId, queryClient]);

  return { sendMessage, isStreaming, streamingContent };
};
