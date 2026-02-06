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

    console.log(`Describing photo ${photoId}: ${imageUrl}`);

    // Call Gemini 2.5 Flash with vision
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
                text: "Describe this photo of a pet in 1-2 detailed sentences. Focus on the pet's appearance, expression, activity, setting, and any notable objects or people. Be specific and vivid.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_completion_tokens: 200,
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
      throw new Error(`AI error: ${response.status}`);
    }

    const result = await response.json();
    const caption = result.choices?.[0]?.message?.content?.trim();

    if (!caption) throw new Error("No caption generated");

    console.log(`Caption for ${photoId}: ${caption}`);

    // Save caption to database
    const { error: updateErr } = await supabase
      .from("project_photos")
      .update({ caption })
      .eq("id", photoId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ caption }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("describe-photo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
