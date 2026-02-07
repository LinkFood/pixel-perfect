import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIMARY_MODEL = "google/gemini-3-pro-image-preview";
const FALLBACK_MODEL = "google/gemini-2.5-flash";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  maxAttempts: number
): Promise<{ base64: string | null; error: string | null; retryable: boolean }> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          modalities: ["text", "image"],
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
        }),
      });

      if (response.status === 429) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Rate limited on attempt ${attempt}, backing off ${backoffMs}ms`);
        if (attempt < maxAttempts) {
          await sleep(backoffMs);
          continue;
        }
        return { base64: null, error: "Rate limited after retries", retryable: true };
      }

      if (response.status === 402) {
        return { base64: null, error: "Credits exhausted", retryable: false };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`AI gateway error (attempt ${attempt}): ${response.status}`, text);
        if (attempt < maxAttempts) {
          await sleep(1000);
          continue;
        }
        return { base64: null, error: `AI error: ${response.status}`, retryable: true };
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      let base64Data: string | null = null;

      if (typeof content === "string") {
        const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
        if (match) base64Data = match[1];
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part.type === "image_url" && part.image_url?.url) {
            const match = part.image_url.url.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
            if (match) { base64Data = match[1]; break; }
          }
        }
      }

      if (base64Data) {
        return { base64: base64Data, error: null, retryable: false };
      }

      console.error(`No image data on attempt ${attempt}. Content type:`, typeof content);
      if (attempt < maxAttempts) {
        await sleep(1000);
        continue;
      }
      return { base64: null, error: "No image in response", retryable: true };
    } catch (e) {
      console.error(`Exception on attempt ${attempt}:`, e);
      if (attempt < maxAttempts) {
        await sleep(1000);
        continue;
      }
      return { base64: null, error: e instanceof Error ? e.message : "Unknown error", retryable: true };
    }
  }
  return { base64: null, error: "Max attempts reached", retryable: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pageId, projectId } = await req.json();
    if (!pageId || !projectId) throw new Error("pageId and projectId are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get page data
    const { data: page, error: pageErr } = await supabase
      .from("project_pages")
      .select("illustration_prompt, scene_description, page_number, page_type")
      .eq("id", pageId)
      .single();
    if (pageErr || !page) throw new Error("Page not found");

    // Get project with appearance profile
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("pet_name, pet_appearance_profile")
      .eq("id", projectId)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    const scenePrompt = page.illustration_prompt || page.scene_description || "A cute pet illustration";
    const appearanceProfile = project.pet_appearance_profile || "";

    // Build the full illustration prompt with character consistency
    const fullPrompt = `Create a children's book illustration in warm watercolor style.

${appearanceProfile ? `CHARACTER (draw EXACTLY as described):\n${appearanceProfile}\n` : ""}
SCENE (Page ${page.page_number}):
${scenePrompt}

STYLE RULES:
- Soft watercolor with gentle ink outlines
- Warm golden lighting, amber/cream/green/blue palette
- ${appearanceProfile ? `${project.pet_name} must look IDENTICAL to the character description above` : "The pet should look friendly and appealing"}
- Square 1:1 composition for 8.5"x8.5" book
- No text or words in the image
- Children's picture book quality, suitable for printing`;

    console.log(`Generating illustration for page ${page.page_number} (${page.page_type}): ${scenePrompt.slice(0, 80)}...`);

    // Try primary model (3 attempts)
    let result = await tryGenerate(LOVABLE_API_KEY, PRIMARY_MODEL, fullPrompt, 3);

    // If primary failed with credits issue, try fallback
    if (!result.base64 && result.error === "Credits exhausted") {
      console.log("Primary model credits exhausted, trying fallback model");
      result = await tryGenerate(LOVABLE_API_KEY, FALLBACK_MODEL, fullPrompt, 2);
    }

    if (!result.base64) {
      const status = result.retryable ? 503 : 402;
      return new Response(JSON.stringify({
        error: result.error,
        retryable: result.retryable,
        pageNumber: page.page_number,
      }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(result.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const storagePath = `illustrations/${projectId}/${pageId}.png`;

    // Upload to storage (upsert to handle regeneration)
    const { error: uploadErr } = await supabase.storage
      .from("pet-photos")
      .upload(storagePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Delete previous illustration record for this page
    await supabase
      .from("project_illustrations")
      .delete()
      .eq("page_id", pageId)
      .eq("project_id", projectId);

    // Insert new record
    const { error: insertErr } = await supabase
      .from("project_illustrations")
      .insert({
        page_id: pageId,
        project_id: projectId,
        storage_path: storagePath,
        generation_prompt: scenePrompt,
        is_selected: true,
      });
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    console.log(`Illustration saved for page ${page.page_number}`);

    return new Response(JSON.stringify({ success: true, storagePath, pageNumber: page.page_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-illustration error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      retryable: true,
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
