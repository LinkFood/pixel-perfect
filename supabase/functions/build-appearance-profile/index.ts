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
      message: `Studying ${photos.length} photos to learn everyone's appearance...`,
      technical_message: `Analyzing ${photos.length} photos | Model: google/gemini-2.5-flash`,
      metadata: { photos_analyzed: photos.length, model: "google/gemini-2.5-flash" },
    });

    // Build multi-image content array for Gemini vision
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: "text",
        text: `Analyze these ${photos.length} photos and identify EVERY distinct subject (person, pet, animal) that appears. Create a separate visual character reference for each one.

${project.pet_type && project.pet_type !== "unknown" && project.pet_type !== "general" ? `The main subject may be a ${project.pet_breed || ""} ${project.pet_type}.` : "Determine what the subjects are from the photos."}

${analyses ? `Photo analyses:\n${analyses}` : captions ? `Photo descriptions: ${captions}` : ""}
${physicalMentions ? `Owner's description: ${physicalMentions.slice(0, 2000)}` : ""}

IMPORTANT: Count how many DISTINCT subjects appear across ALL photos. If there are two babies, two dogs, a person and a pet, etc. — each one gets their own profile.

Return a JSON array with one entry per subject. Each entry has:
- "name": a descriptive label (e.g. "baby in red hat", "golden retriever", "toddler with curly hair"). Use "${project.pet_name}" as the name if there's only one subject.
- "profile": a detailed physical appearance paragraph starting with the name. Include: what they are (breed, species, age range), size and build, colors/patterns/textures, face shape, eye color, distinguishing features, distinctive markings or accessories.

Be extremely specific — an illustrator should be able to draw each subject identically on every page from your description alone.

Return ONLY the JSON array, no other text. Example format:
[{"name": "Luna", "profile": "Luna is a small calico cat with..."}, {"name": "Max", "profile": "Max is a toddler with sandy blonde hair..."}]`,
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
        max_completion_tokens: 800,
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
    const rawContent = result.choices?.[0]?.message?.content?.trim();

    if (!rawContent) throw new Error("No profile generated");

    // Parse the JSON array response
    let characterProfiles: Array<{ name: string; profile: string }> = [];
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      characterProfiles = JSON.parse(cleaned);
      if (!Array.isArray(characterProfiles)) {
        // Single object returned — wrap it
        characterProfiles = [characterProfiles];
      }
    } catch {
      // Fallback: treat the whole response as a single profile (backward compat)
      console.warn("Could not parse character_profiles JSON, falling back to single profile");
      characterProfiles = [{ name: project.pet_name, profile: rawContent }];
    }

    // Build combined profile for backward compatibility
    const combinedProfile = characterProfiles.map(c => c.profile).join("\n\n");

    console.log(`Detected ${characterProfiles.length} character(s): ${characterProfiles.map(c => c.name).join(", ")}`);
    console.log(`Combined appearance profile: ${combinedProfile.slice(0, 100)}...`);

    // Build log: appearance profile complete
    await supabase.from("build_log").insert({
      project_id: projectId,
      phase: "appearance",
      level: "milestone",
      message: `Got it! Found ${characterProfiles.length} character${characterProfiles.length !== 1 ? "s" : ""}: ${characterProfiles.map(c => c.name).join(" & ")}.`,
      technical_message: `Profile: ${combinedProfile.slice(0, 120)}...`,
      metadata: { photos_analyzed: photos.length, model: "google/gemini-2.5-flash", profile_length: combinedProfile.length, character_count: characterProfiles.length },
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

    // Save profile, character_profiles, and context brief to projects table
    const { error: updateErr } = await supabase
      .from("projects")
      .update({
        pet_appearance_profile: combinedProfile,
        character_profiles: characterProfiles,
        ...(photoContextBrief ? { photo_context_brief: photoContextBrief } : {}),
      })
      .eq("id", projectId);

    if (updateErr) {
      console.error("Failed to save appearance profile:", updateErr);
      return new Response(JSON.stringify({ success: false, error: "Failed to save profile to database" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Appearance profile saved: ${characterProfiles.length} character(s)${photoContextBrief ? " (with photo context brief)" : ""}`);

    return new Response(JSON.stringify({ success: true, profile: combinedProfile, characterProfiles, photoContextBrief }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("build-appearance-profile error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", retryable: false }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
