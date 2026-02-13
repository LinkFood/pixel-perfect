import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { photoId, projectId } = await req.json();
    if (!photoId || !projectId) throw new Error("photoId and projectId are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get photo record
    const { data: photo, error: photoErr } = await supabase
      .from("project_photos")
      .select("storage_path")
      .eq("id", photoId)
      .single();
    if (photoErr || !photo) throw new Error("Photo not found");

    // Get public URL
    const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(photo.storage_path);
    const imageUrl = urlData.publicUrl;

    // Check for unsupported image formats
    const supportedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const lowerPath = photo.storage_path.toLowerCase();
    if (!supportedExts.some(ext => lowerPath.endsWith(ext))) {
      console.warn(`Skipping unsupported format: ${photo.storage_path}`);
      const fallbackCaption = "Photo uploaded (format not supported for AI analysis)";
      await supabase.from("project_photos").update({ caption: fallbackCaption }).eq("id", photoId);
      return new Response(JSON.stringify({ caption: fallbackCaption }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Describing photo ${photoId}: ${imageUrl}`);

    // Call Gemini 2.5 Flash with vision — structured JSON analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this photo and return a JSON object with these fields:
{
  "scene_summary": "1-2 vivid sentences describing the overall scene",
  "setting": "where this takes place",
  "subject_type": "what the main subject is (e.g. dog, cat, child, couple, family, landscape)",
  "activities": ["what the subjects are doing"],
  "people_present": ["descriptions of people visible"],
  "subject_mood": "the main subject's apparent mood or expression",
  "subject_appearance_notes": "specific appearance details of the main subject",
  "notable_details": ["interesting objects, decorations, environmental details"],
  "potential_story_hooks": ["1-2 story moment ideas inspired by this scene"]
}
Be specific and vivid. The subject could be a person, pet, place, or anything.
Return ONLY valid JSON, no markdown fences.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_completion_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`AI gateway error: ${response.status}`, text);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 400) {
        console.warn(`AI rejected photo ${photoId} (400), saving fallback caption`);
        const fallbackCaption = "Photo uploaded (could not be analyzed automatically)";
        await supabase.from("project_photos").update({ caption: fallbackCaption }).eq("id", photoId);
        return new Response(JSON.stringify({ caption: fallbackCaption }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const rawContent = result.choices?.[0]?.message?.content?.trim();

    if (!rawContent) throw new Error("No analysis generated");

    // Parse structured JSON analysis with fallback
    let aiAnalysis: Record<string, unknown>;
    let caption: string;

    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      aiAnalysis = JSON.parse(cleaned);
      caption = (aiAnalysis.scene_summary as string) || rawContent.slice(0, 200);
    } catch {
      console.warn(`JSON parse failed for photo ${photoId}, using raw text as fallback`);
      aiAnalysis = { scene_summary: rawContent };
      caption = rawContent.slice(0, 200);
    }

    console.log(`Analysis for ${photoId}: ${caption}`);

    // Build log: photo caption complete
    await supabase.from("build_log").insert({
      project_id: projectId,
      phase: "caption",
      level: "milestone",
      message: `Photo analyzed: ${caption.slice(0, 80)}${caption.length > 80 ? "..." : ""}`,
      technical_message: `Photo ${photoId} | Model: google/gemini-2.5-flash`,
      metadata: { photo_id: photoId, model: "google/gemini-2.5-flash" },
    });

    // Save both caption (backward compat) and structured ai_analysis
    const { error: updateErr } = await supabase
      .from("project_photos")
      .update({ caption, ai_analysis: aiAnalysis })
      .eq("id", photoId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ caption, ai_analysis: aiAnalysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("describe-photo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
