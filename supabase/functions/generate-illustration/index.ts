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

// Extract base64 image data from various AI gateway response formats
function extractImageData(message: any): { base64: string | null; contentType: string } {
  let base64Data: string | null = null;
  let detectedContentType = "image/png";

  // Primary: check message.images array (Lovable AI gateway format)
  if (Array.isArray(message?.images) && message.images.length > 0) {
    const img = message.images[0];
    const url = img?.image_url?.url || img?.url || (typeof img === "string" ? img : null);
    if (url) {
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

  return { base64: base64Data, contentType: detectedContentType };
}

async function tryGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  maxAttempts: number
): Promise<{ base64: string | null; contentType: string; error: string | null; retryable: boolean }> {
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
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Rate limited on attempt ${attempt}, backing off ${backoffMs}ms`);
        if (attempt < maxAttempts) {
          await sleep(backoffMs);
          continue;
        }
        return { base64: null, contentType: "image/png", error: "Rate limited after retries", retryable: true };
      }

      if (response.status === 402) {
        return { base64: null, contentType: "image/png", error: "Credits exhausted", retryable: false };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`AI gateway error (attempt ${attempt}): ${response.status}`, text);
        if (attempt < maxAttempts) {
          await sleep(1000);
          continue;
        }
        return { base64: null, contentType: "image/png", error: `AI error: ${response.status}`, retryable: true };
      }

      const result = await response.json();
      const message = result.choices?.[0]?.message;
      const { base64, contentType } = extractImageData(message);

      if (base64) {
        return { base64, contentType, error: null, retryable: false };
      }

      console.error(`No image data on attempt ${attempt}. Message keys:`, Object.keys(message || {}));
      if (attempt < maxAttempts) {
        await sleep(1000);
        continue;
      }
      return { base64: null, contentType: "image/png", error: "No image in response", retryable: true };
    } catch (e) {
      console.error(`Exception on attempt ${attempt}:`, e);
      if (attempt < maxAttempts) {
        await sleep(1000);
        continue;
      }
      return { base64: null, contentType: "image/png", error: e instanceof Error ? e.message : "Unknown error", retryable: true };
    }
  }
  return { base64: null, contentType: "image/png", error: "Max attempts reached", retryable: true };
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
      .select("pet_name, pet_type, pet_breed, pet_appearance_profile")
      .eq("id", projectId)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    const scenePrompt = page.illustration_prompt || page.scene_description || "A cute pet illustration";
    const appearanceProfile = project.pet_appearance_profile || "";
    const breed = project.pet_breed || project.pet_type || "dog";

    // Extract key visual traits for reinforcement
    const breedUpper = breed.toUpperCase();
    const petNameUpper = project.pet_name.toUpperCase();

    // Build the full illustration prompt with character consistency at TOP and BOTTOM
    const fullPrompt = appearanceProfile
      ? `CRITICAL CHARACTER REQUIREMENT — READ THIS FIRST:
${petNameUpper} MUST be drawn as a ${breedUpper}. ${appearanceProfile}
DO NOT draw any other breed. DO NOT change the colors. DO NOT add a collar unless specified above.

---

SCENE (Page ${page.page_number}):
${scenePrompt}

STYLE RULES:
- Soft watercolor with gentle ink outlines
- Warm golden lighting, amber/cream/green/blue palette
- Square 1:1 composition for 8.5"x8.5" book
- No text or words in the image
- Children's picture book quality, suitable for printing

---

REMINDER — CHARACTER MUST MATCH EXACTLY:
The ${project.pet_type} in this image MUST be a ${breed}. ${appearanceProfile.split('.').slice(0, 3).join('.')}. NEVER draw a different breed, color, or body type.`
      : `Create a children's book illustration in warm watercolor style.

SCENE (Page ${page.page_number}):
${scenePrompt}

STYLE RULES:
- Soft watercolor with gentle ink outlines
- Warm golden lighting, amber/cream/green/blue palette
- The pet should look friendly and appealing
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

    // Strip ALL whitespace/newlines from base64 before decoding
    let base64Data = result.base64.replace(/[\s\n\r]/g, "");
    let detectedContentType = result.contentType;

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
        generation_prompt: scenePrompt,
        is_selected: true,
      });
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    console.log(`Illustration saved for page ${page.page_number} (${detectedContentType}, ${bytes.length} bytes)`);

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
