import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(petName: string, appearanceProfile: string | null) {
  const characterBlock = appearanceProfile
    ? `\n\nCHARACTER APPEARANCE (use in EVERY illustration_prompt):\n${appearanceProfile}\n\nCRITICAL: Every illustration_prompt you write MUST include ${petName}'s full physical description so the illustrator draws the pet consistently on every single page. Copy the key details (breed, coat colors, markings, size) into each illustration_prompt.`
    : "";

  return `You are a master children's book author for PetPage Studios. You create heartwarming, beautifully written picture books about real pets based on interview transcripts.
${characterBlock}

Your task: Generate a complete children's storybook that weaves the pet's REAL memories, personality, and special moments into a magical narrative that children and pet owners will treasure forever. Use as many pages as the story naturally needs — let the depth of the interview guide the length.

Structure:
- Page 1: Cover concept (title page with the pet's name)
- Page 2: Dedication page
- Middle pages: The story (as many narrative pages as the story needs)
- Second-to-last page: A heartfelt closing/reflection page that naturally transitions to the photo gallery — something like "And here is ${petName}, just as they really were..." or "Turn the page to see the real ${petName}..."
- Last page: Back cover concept

IMPORTANT: The final pages of this book (after your story) will feature the family's real photos of ${petName} as a keepsake gallery. Your closing page should create a beautiful emotional bridge from the illustrated story to those real photos. Make the reader want to turn the page and see the real pet.

Writing style:
- Warm, lyrical prose suitable for reading aloud
- Rich sensory details that bring scenes to life
- Weave in REAL details from the interview — specific memories, quirks, habits
- Each page should have 2-4 sentences (picture book pacing)
- Create an emotional arc: introduction → adventures → challenges → celebration of bond
- If the pet has passed, handle with grace — celebrating their life rather than focusing on loss
- Include as many real memories and moments from the interview as possible — don't leave good stories on the table

For each page, provide a detailed illustration prompt describing exactly what the illustration should show — composition, colors, mood, specific visual details.${appearanceProfile ? ` ALWAYS include ${petName}'s physical description in the illustration prompt.` : ""}

You MUST call the generate_pages function with all pages.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { projectId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get project details including appearance profile
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    // Get interview transcript
    const { data: interview } = await supabase
      .from("project_interview")
      .select("role, content")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const transcript = (interview || [])
      .map(m => `${m.role === "user" ? "Owner" : "Interviewer"}: ${m.content}`)
      .join("\n\n");

    // Get photo captions
    const { data: photos } = await supabase
      .from("project_photos")
      .select("caption")
      .eq("project_id", projectId)
      .not("caption", "is", null);

    const captions = (photos || []).filter(p => p.caption).map(p => p.caption).join(", ");

    console.log(`Generating story for ${project.pet_name}, ${interview?.length || 0} interview messages, ${photos?.length || 0} captioned photos`);

    const systemPrompt = buildSystemPrompt(project.pet_name, null);

    const userPrompt = `Create a children's storybook about ${project.pet_name}, a ${project.pet_breed || ""} ${project.pet_type}. Use as many pages as the story naturally needs — don't cut short, include every meaningful memory.

INTERVIEW TRANSCRIPT:
${transcript}

${captions ? `PHOTO CAPTIONS: ${captions}` : ""}

Generate all pages now using the generate_pages function.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_pages",
            description: "Generate all pages of the storybook",
            parameters: {
              type: "object",
              properties: {
                pages: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      page_number: { type: "integer" },
                      page_type: { type: "string", enum: ["cover", "dedication", "story", "closing", "back_cover"] },
                      text_content: { type: "string" },
                      illustration_prompt: { type: "string" },
                      scene_description: { type: "string" },
                    },
                    required: ["page_number", "page_type", "text_content", "illustration_prompt", "scene_description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["pages"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_pages" } },
        temperature: 0.9,
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
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const { pages } = JSON.parse(toolCall.function.arguments);
    console.log(`Generated ${pages.length} pages`);

    // Delete existing pages for this project (in case of regeneration)
    await supabase.from("project_pages").delete().eq("project_id", projectId);

    // Insert pages one by one for realtime updates
    for (const page of pages) {
      const { error: insertErr } = await supabase.from("project_pages").insert({
        project_id: projectId,
        page_number: page.page_number,
        page_type: page.page_type,
        text_content: page.text_content,
        illustration_prompt: page.illustration_prompt,
        scene_description: page.scene_description,
      });
      if (insertErr) console.error(`Failed to insert page ${page.page_number}:`, insertErr);
    }

    // Update project status
    await supabase.from("projects").update({ status: "review" }).eq("id", projectId);

    return new Response(JSON.stringify({ success: true, pagesGenerated: pages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-story error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", retryable: true }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
