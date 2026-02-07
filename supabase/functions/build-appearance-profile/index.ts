import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Get project details
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("pet_name, pet_type, pet_breed")
      .eq("id", projectId)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    // Get photos (up to 10, favorites first)
    const { data: photos } = await supabase
      .from("project_photos")
      .select("storage_path, caption")
      .eq("project_id", projectId)
      .order("is_favorite", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(10);

    if (!photos || photos.length === 0) {
      return new Response(JSON.stringify({ error: "No photos uploaded yet" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build image URLs
    const imageUrls = photos.map(p => {
      const { data } = supabase.storage.from("pet-photos").getPublicUrl(p.storage_path);
      return data.publicUrl;
    });

    // Gather captions
    const captions = photos
      .filter(p => p.caption)
      .map(p => p.caption)
      .join(". ");

    // Get interview mentions of physical traits (first 40 messages)
    const { data: interview } = await supabase
      .from("project_interview")
      .select("content, role")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(40);

    const physicalMentions = (interview || [])
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join(" ");

    console.log(`Building appearance profile for ${project.pet_name} from ${photos.length} photos`);

    // Build multi-image content array for Gemini vision
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: "text",
        text: `Create a visual character reference for a children's book illustrator. Analyze these ${photos.length} photos of a pet named ${project.pet_name} (a ${project.pet_breed || ""} ${project.pet_type}).

${captions ? `Photo descriptions: ${captions}` : ""}
${physicalMentions ? `Owner's description: ${physicalMentions.slice(0, 2000)}` : ""}

Describe this pet's exact appearance in a single detailed paragraph starting with "${project.pet_name} is a..." Include:
- Exact breed, size, and build
- Coat colors, patterns, and texture
- Face shape, ear style, eye color
- Distinctive markings (patches, spots, stripes)
- Tail style and any unique physical features

Be extremely specific — an illustrator should be able to draw this pet identically on every page of a book from your description alone.`,
      },
    ];

    // Add each photo as an image_url part
    for (const url of imageUrls) {
      contentParts.push({
        type: "image_url",
        image_url: { url },
      });
    }

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
            content: contentParts,
          },
        ],
        max_completion_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`AI gateway error: ${response.status}`, text);
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
    const profile = result.choices?.[0]?.message?.content?.trim();

    if (!profile) throw new Error("No profile generated");

    console.log(`Appearance profile for ${project.pet_name}: ${profile.slice(0, 100)}...`);

    // Save to project
    const { error: updateErr } = await supabase
      .from("projects")
      .update({ pet_appearance_profile: profile })
      .eq("id", projectId);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-appearance-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", retryable: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
