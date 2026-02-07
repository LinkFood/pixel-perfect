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
    if (!pageId || !projectId) throw new Error("pageId and projectId are required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get page data
    const { data: page, error: pageErr } = await supabase
      .from("project_pages")
      .select("illustration_prompt, scene_description, page_number")
      .eq("id", pageId)
      .single();
    if (pageErr || !page) throw new Error("Page not found");

    const prompt = page.illustration_prompt || page.scene_description || "A cute pet illustration";

    console.log(`Generating illustration for page ${page.page_number}: ${prompt.slice(0, 80)}...`);

    // Call Gemini image generation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["text", "image"],
        messages: [
          {
            role: "user",
            content: `Generate a beautiful children's book illustration in a warm, whimsical watercolor style. The illustration should be colorful, friendly, and suitable for a picture book.

Scene to illustrate: ${prompt}

Style: Soft watercolor with gentle outlines, warm lighting, pastel and vibrant colors mixed. The style should be consistent across all pages of a children's book — think classic picture book illustration.`,
          },
        ],
        temperature: 0.8,
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
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    
    // Extract base64 image from response
    const content = result.choices?.[0]?.message?.content;
    let base64Data: string | null = null;

    if (typeof content === "string") {
      // Check for inline base64 image in markdown format
      const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
      if (match) base64Data = match[1];
    } else if (Array.isArray(content)) {
      // Multi-part response
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const match = part.image_url.url.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
          if (match) { base64Data = match[1]; break; }
        }
      }
    }

    if (!base64Data) {
      console.error("No image data in response. Content type:", typeof content);
      console.error("Content preview:", JSON.stringify(content).slice(0, 500));
      throw new Error("No image generated");
    }

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
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
        generation_prompt: prompt,
        is_selected: true,
      });
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    console.log(`Illustration saved for page ${page.page_number}`);

    return new Response(JSON.stringify({ success: true, storagePath }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-illustration error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
