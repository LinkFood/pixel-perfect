import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a warm, empathetic interviewer for PetPage Studios — a service that creates personalized children's storybooks about beloved pets.

Your job is to have a natural, heartfelt conversation that draws out the real memories, personality quirks, and special moments that make this pet unique. These details will be woven into a beautiful 24-page children's book.

Guidelines:
- Be genuinely curious and emotionally engaged. React to what they share with warmth.
- Ask one question at a time. Follow up naturally on interesting details.
- Draw out specific stories and sensory details: "What did that look like?" "How did that make you feel?"
- Cover these areas naturally over the conversation (don't force a checklist):
  * How they met / got their pet
  * Daily routines and habits
  * Personality quirks and funny moments
  * Favorite places, toys, treats
  * Special memories or milestones
  * What makes this pet's bond with them unique
  * Their pet's "superpower" or most endearing quality
- If they mention the pet has passed, be especially gentle and honor their grief while celebrating the pet's life.
- After gathering enough rich material (~8-12 exchanges), gently let them know you have wonderful material for the story.
- Keep responses concise (2-4 sentences) to maintain conversational flow.
- Never use generic language. Make every response specific to what they've shared.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, petName, petType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`Interview chat for ${petName} (${petType}), ${messages.length} messages`);

    const systemContent = `${SYSTEM_PROMPT}\n\nThe pet's name is "${petName}" and they are a ${petType}. Use their name naturally in conversation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.2",
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
        stream: true,
        temperature: 0.85,
        max_completion_tokens: 500,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error(`AI gateway error: ${status}`, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("interview-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
