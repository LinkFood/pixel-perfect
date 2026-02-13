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

    // Get photos (up to 10, favorites first) — include ai_analysis for context brief
    const { data: photos } = await supabase
      .from("project_photos")
      .select("storage_path, caption, ai_analysis")
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

    // Gather structured analyses for richer context
    const analyses = photos
      .filter(p => p.ai_analysis && typeof p.ai_analysis === "object")
      .map((p, i) => {
        const a = p.ai_analysis as Record<string, unknown>;
        const appearanceNotes = a.subject_appearance_notes || a.pet_appearance_notes;
        return `Photo ${i + 1}: ${a.scene_summary || p.caption || ""}${appearanceNotes ? ` | Appearance: ${appearanceNotes}` : ""}`;
      })
      .join("\n");

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

    // Build log: appearance profile starting
    await supabase.from("build_log").insert({
      project_id: projectId,
      phase: "appearance",
      level: "milestone",
      message: `Studying ${photos.length} photos to learn ${project.pet_name}'s appearance...`,
      technical_message: `Analyzing ${photos.length} photos | Model: google/gemini-2.5-flash`,
      metadata: { photos_analyzed: photos.length, model: "google/gemini-2.5-flash" },
    });

    // Build multi-image content array for Gemini vision
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: "text",
        text: `Create a visual character reference for a children's book illustrator. Analyze these ${photos.length} photos of a subject named ${project.pet_name}.${project.pet_type && project.pet_type !== "unknown" && project.pet_type !== "general" ? ` They are a ${project.pet_breed || ""} ${project.pet_type}.` : " Determine what the subject is from the photos."}

${analyses ? `Photo analyses:\n${analyses}` : captions ? `Photo descriptions: ${captions}` : ""}
${physicalMentions ? `Owner's description: ${physicalMentions.slice(0, 2000)}` : ""}

Focus ONLY on physical appearance synthesis — do not re-describe scenes or activities.

Describe this subject's exact appearance in a single detailed paragraph starting with "${project.pet_name} is a..." Include:
- What they are (breed, species, age range, etc.)
- Size and build
- Colors, patterns, and textures (coat, hair, skin, clothing)
- Face shape, eye color, distinguishing features
- Distinctive markings or accessories
- Any unique physical features

Be extremely specific — an illustrator should be able to draw this subject identically on every page of a book from your description alone.`,
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

    // Build log: appearance profile complete
    await supabase.from("build_log").insert({
      project_id: projectId,
      phase: "appearance",
      level: "milestone",
      message: `Got it! I know exactly what ${project.pet_name} looks like now.`,
      technical_message: `Profile: ${profile.slice(0, 120)}...`,
      metadata: { photos_analyzed: photos.length, model: "google/gemini-2.5-flash", profile_length: profile.length },
    });

    // Compile photo_context_brief from all ai_analysis data (no extra API call)
    const briefParts: string[] = [];
    photos.forEach((p, i) => {
      const a = p.ai_analysis as Record<string, unknown> | null;
      if (!a) return;
      const parts: string[] = [];
      if (a.scene_summary) parts.push(a.scene_summary as string);
      if (a.setting) parts.push(`Setting: ${a.setting}`);
      if (Array.isArray(a.activities) && a.activities.length > 0) parts.push(`Activities: ${(a.activities as string[]).join(", ")}`);
      if (Array.isArray(a.people_present) && a.people_present.length > 0) parts.push(`People: ${(a.people_present as string[]).join(", ")}`);
      const mood = a.subject_mood || a.pet_mood;
      if (mood) parts.push(`Mood: ${mood}`);
      if (Array.isArray(a.potential_story_hooks) && a.potential_story_hooks.length > 0) parts.push(`Story hooks: ${(a.potential_story_hooks as string[]).join("; ")}`);
      if (parts.length > 0) briefParts.push(`Photo ${i + 1}: ${parts.join(". ")}`);
    });
    const photoContextBrief = briefParts.length > 0 ? briefParts.join("\n\n") : null;

    // Save profile and context brief to projects table
    const { error: updateErr } = await supabase
      .from("projects")
      .update({
        pet_appearance_profile: profile,
        ...(photoContextBrief ? { photo_context_brief: photoContextBrief } : {}),
      })
      .eq("id", projectId);

    if (updateErr) {
      console.error("Failed to save appearance profile:", updateErr);
    } else {
      console.log(`Appearance profile saved for ${project.pet_name}${photoContextBrief ? " (with photo context brief)" : ""}`);
    }

    return new Response(JSON.stringify({ success: true, profile, photoContextBrief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-appearance-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", retryable: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
