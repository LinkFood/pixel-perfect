import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MODEL = "google/gemini-3-pro-image-preview";

function extractImageData(message: any): { base64: string | null; contentType: string } {
  let base64Data: string | null = null;
  let detectedContentType = "image/png";

  if (Array.isArray(message?.images) && message.images.length > 0) {
    const img = message.images[0];
    const url = img?.image_url?.url || img?.url || (typeof img === "string" ? img : null);
    if (url) {
      const dataUriMatch = url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s);
      if (dataUriMatch) {
        detectedContentType = dataUriMatch[1] === "jpg" ? "image/jpeg" : `image/${dataUriMatch[1]}`;
        base64Data = dataUriMatch[2];
      } else {
        base64Data = url;
      }
    }
    if (!base64Data && (img?.b64_json || img?.data)) {
      base64Data = img.b64_json || img.data;
    }
  }

  if (!base64Data) {
    const content = message?.content;
    if (typeof content === "string" && content.length > 100) {
      const match = content.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/);
      if (match) {
        detectedContentType = match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`;
        base64Data = match[2];
      }
    }
    if (!base64Data && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const match = part.image_url.url.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/);
          if (match) {
            detectedContentType = match[1] === "jpg" ? "image/jpeg" : `image/${match[1]}`;
            base64Data = match[2];
            break;
          }
        }
        if (part.inline_data?.data) {
          base64Data = part.inline_data.data;
          if (part.inline_data.mime_type) detectedContentType = part.inline_data.mime_type;
          break;
        }
      }
    }
  }

  return { base64: base64Data, contentType: detectedContentType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    if (!projectId) throw new Error("projectId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get first captioned photo
    const { data: photos } = await supabase
      .from("project_photos")
      .select("caption, ai_analysis, storage_path")
      .eq("project_id", projectId)
      .not("caption", "is", null)
      .order("sort_order", { ascending: true })
      .limit(3);

    if (!photos || photos.length === 0) {
      return new Response(JSON.stringify({ error: "No captioned photos yet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a scene description from the first few photos
    const sceneParts = photos.map((p: any) => {
      const analysis = p.ai_analysis as Record<string, any> | null;
      return analysis?.scene_summary || p.caption || "";
    }).filter(Boolean);

    const sceneDescription = sceneParts.join(" | ");

    const prompt = `Create a warm, whimsical children's picture book illustration inspired by these real photos:

${sceneDescription}

STYLE:
- Soft watercolor with gentle ink outlines
- Warm golden lighting, amber/cream/green/blue palette  
- Square 1:1 composition
- No text or words in the image
- Evocative and emotional — this is a preview of a storybook about someone's real life
- Make it feel magical and personal`;

    console.log(`Generating preview illustration for project ${projectId}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        modalities: ["text", "image"],
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`AI gateway error: ${response.status}`, text);
      return new Response(JSON.stringify({ error: `AI error: ${response.status}` }), {
        status: response.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;
    const { base64, contentType } = extractImageData(message);

    if (!base64) {
      console.error("No image data in preview response");
      return new Response(JSON.stringify({ error: "No image generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode and upload
    const cleanBase64 = base64.replace(/[\s\n\r]/g, "");
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length < 1000) {
      throw new Error(`Preview image too small (${bytes.length} bytes)`);
    }

    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
    const actualType = isPNG ? "image/png" : isJPEG ? "image/jpeg" : contentType;
    const ext = actualType === "image/jpeg" ? "jpg" : "png";

    const storagePath = `previews/${projectId}/preview-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("pet-photos")
      .upload(storagePath, bytes, { contentType: actualType, upsert: true });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Get public URL
    const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(storagePath);

    console.log(`Preview illustration saved: ${storagePath}`);

    return new Response(JSON.stringify({ success: true, storagePath, publicUrl: urlData.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-preview-illustration error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
