import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pageId, projectId } = await req.json();
    if (!pageId || !projectId) throw new Error("pageId and projectId required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current page
    const { data: page, error: pageErr } = await supabase
      .from("project_pages")
      .select("*")
      .eq("id", pageId)
      .single();
    if (pageErr || !page) throw new Error("Page not found");

    // Get project with appearance profile
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (!project) throw new Error("Project not found");

    // Get surrounding pages for context
    const { data: surroundingPages } = await supabase
      .from("project_pages")
      .select("page_number, text_content, page_type")
      .eq("project_id", projectId)
      .gte("page_number", Math.max(1, page.page_number - 2))
      .lte("page_number", page.page_number + 2)
      .neq("id", pageId)
      .order("page_number");

    // Get interview excerpt (increased to 40 messages)
    const { data: interview } = await supabase
      .from("project_interview")
      .select("role, content")
      .eq("project_id", projectId)
      .order("created_at")
      .limit(40);

    const transcript = (interview || [])
      .map(m => `${m.role === "user" ? "Owner" : "Interviewer"}: ${m.content}`)
      .join("\n");

    const context = (surroundingPages || [])
      .map(p => `Page ${p.page_number} (${p.page_type}): ${p.text_content}`)
      .join("\n");

    const appearanceNote = project.pet_appearance_profile
      ? `\n\nCHARACTER APPEARANCE (include in illustration_prompt):\n${project.pet_appearance_profile}\n\nThe illustration_prompt MUST include ${project.pet_name}'s physical description for consistent illustration.`
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          {
            role: "system",
            content: `You are rewriting a single page of a children's picture book about ${project.pet_name}${project.pet_type && project.pet_type !== "unknown" && project.pet_type !== "general" ? ` (a ${project.pet_breed || ""} ${project.pet_type})` : ""}. Keep the same page type and position in the story but write fresh text and a new illustration prompt. Output JSON with text_content and illustration_prompt fields only.${appearanceNote}`,
          },
          {
            role: "user",
            content: `Surrounding pages for context:\n${context}\n\nInterview transcript:\n${transcript}\n\nCurrent page ${page.page_number} (${page.page_type}):\n"${page.text_content}"\n\nPlease rewrite this page with fresh text and a new illustration prompt. Return valid JSON: {"text_content": "...", "illustration_prompt": "..."}`,
          },
        ],
        temperature: 0.9,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`AI error: ${response.status}`, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited", retryable: true }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted", retryable: false }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid response. Please try again.", retryable: true }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await supabase
      .from("project_pages")
      .update({
        text_content: parsed.text_content,
        illustration_prompt: parsed.illustration_prompt,
      })
      .eq("id", pageId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("regenerate-page error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", retryable: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
