import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractImageData(message: any): { base64: string | null; contentType: string } {
  let base64Data: string | null = null;
  let detectedContentType = "image/png";

  if (Array.isArray(message?.images) && message.images.length > 0) {
    const img = message.images[0];
    const url = img?.image_url?.url || img?.url || (typeof img === "string" ? img : null);
    if (url) {
      const m = url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s);
      if (m) {
        detectedContentType = m[1] === "jpg" ? "image/jpeg" : `image/${m[1]}`;
        base64Data = m[2];
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
      const m = content.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/);
      if (m) {
        detectedContentType = m[1] === "jpg" ? "image/jpeg" : `image/${m[1]}`;
        base64Data = m[2];
      }
    }
    if (!base64Data && Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          const m = part.image_url.url.match(/data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)/);
          if (m) {
            detectedContentType = m[1] === "jpg" ? "image/jpeg" : `image/${m[1]}`;
            base64Data = m[2];
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `A single adorable rabbit sitting upright, facing slightly left, in soft watercolor style with gentle ink outlines. Warm golden lighting, amber/cream palette. Simple, clean composition on a pure white background with no other elements. No text, no words, no letters. Suitable as a brand mascot/logo. Square 1:1 composition.`;

    console.log("Generating watercolor rabbit logo...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        modalities: ["text", "image"],
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message;
    const { base64, contentType } = extractImageData(message);

    if (!base64) {
      console.error("No image data in response. Keys:", Object.keys(message || {}));
      throw new Error("No image returned from model");
    }

    const clean = base64.replace(/[\s\n\r]/g, "");
    const dataUrl = `data:${contentType};base64,${clean}`;

    console.log(`Logo generated successfully (${clean.length} base64 chars)`);

    return new Response(JSON.stringify({ success: true, dataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-logo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
