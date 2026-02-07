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
    
    const message = result.choices?.[0]?.message;
    let base64Data: string | null = null;
    let detectedContentType = "image/png"; // default

    // Primary: check message.images array (Lovable AI gateway format)
    if (Array.isArray(message?.images) && message.images.length > 0) {
      const img = message.images[0];
      const url = img?.image_url?.url || img?.url || (typeof img === "string" ? img : null);
      if (url) {
        // Detect content type from data URI
        const dataUriMatch = url.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/s);
        if (dataUriMatch) {
          const format = dataUriMatch[1];
          detectedContentType = format === "jpg" ? "image/jpeg" : `image/${format}`;
          base64Data = dataUriMatch[2];
        } else {
          base64Data = url;
        }
      }
      if (!base64Data && (img?.b64_json || img?.data)) {
        base64Data = img.b64_json || img.data;
      }
    }

    // Fallback: check content for inline base64 or multi-part
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
            if (part.inline_data.mime_type) {
              detectedContentType = part.inline_data.mime_type;
            }
            break;
          }
        }
      }
    }

    if (!base64Data) {
      console.error("No image data found. Message keys:", Object.keys(message || {}));
      console.error("Images field:", JSON.stringify(message?.images).slice(0, 500));
      throw new Error("No image generated");
    }

    // Strip ALL whitespace/newlines from base64 before decoding
    base64Data = base64Data.replace(/[\s\n\r]/g, "");

    console.log(`Base64 length: ${base64Data.length}, first 50 chars: ${base64Data.slice(0, 50)}`);
    console.log(`Detected content type: ${detectedContentType}`);

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Validate image data
    console.log(`Decoded ${bytes.length} bytes. First 8 bytes: [${Array.from(bytes.slice(0, 8)).join(", ")}]`);

    if (bytes.length < 1000) {
      console.error(`Image too small: ${bytes.length} bytes — likely corrupt`);
      throw new Error(`Generated image is too small (${bytes.length} bytes), likely corrupt`);
    }

    // Check magic bytes
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isWebP = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;

    if (!isPNG && !isJPEG && !isWebP) {
      console.error(`Unknown image format. First 16 bytes: [${Array.from(bytes.slice(0, 16)).join(", ")}]`);
      throw new Error("Decoded data does not appear to be a valid image (bad magic bytes)");
    }

    // Use correct content type based on actual magic bytes (override detected)
    if (isPNG) detectedContentType = "image/png";
    else if (isJPEG) detectedContentType = "image/jpeg";
    else if (isWebP) detectedContentType = "image/webp";

    const ext = detectedContentType === "image/jpeg" ? "jpg" : detectedContentType === "image/webp" ? "webp" : "png";
    const storagePath = `illustrations/${projectId}/${pageId}.${ext}`;

    console.log(`Uploading as ${detectedContentType} to ${storagePath} (${bytes.length} bytes)`);

    // Upload to storage (upsert to handle regeneration)
    const { error: uploadErr } = await supabase.storage
      .from("pet-photos")
      .upload(storagePath, bytes, {
        contentType: detectedContentType,
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

    console.log(`Illustration saved for page ${page.page_number} (${detectedContentType}, ${bytes.length} bytes)`);

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
