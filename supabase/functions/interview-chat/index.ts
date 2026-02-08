import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a warm, empathetic interviewer for PhotoRabbit — a service that turns real photos and memories into personalized illustrated creations.

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
- Keep responses concise (2-4 sentences) to maintain conversational flow.
- Never use generic language. Make every response specific to what they've shared.`;

function buildSystemPrompt(petName: string, petType: string, userMessageCount: number, photoCaptions?: string[], photoContextBrief?: string, productType?: string): string {
  const product = productType || "storybook";
  let prompt = `${SYSTEM_PROMPT}\n\nThe subject's name is "${petName}" and they are a ${petType}. Use their name naturally in conversation. You are helping create a ${product} based on their photos and stories.`;

  if (photoContextBrief) {
    // Rich photo context — reference specific scenes, people, moods, and settings
    prompt += `\n\nYou have DEEPLY analyzed the owner's photos of ${petName}. Here is what you saw in each photo:\n\n${photoContextBrief}\n\nUse this knowledge naturally and specifically in conversation. Reference particular scenes, settings, people, and moments you noticed. Show the owner you truly looked at and understood their photos. Ask about the stories behind specific moments you observed. This creates a "wow, it actually looked at my photos" moment.`;
  } else if (photoCaptions && photoCaptions.length > 0) {
    // Fallback to basic captions if brief not available
    prompt += `\n\nThe owner has uploaded photos of ${petName}. Here are AI-generated descriptions of what's in them:\n${photoCaptions.map((c, i) => `- Photo ${i + 1}: ${c}`).join("\n")}\nReference specific photos naturally in your conversation to show you've seen them. Ask about the moments captured in the photos.`;
  }

  if (userMessageCount >= 15) {
    prompt += `\n\nIMPORTANT: You have received MORE than enough material. DO NOT ask any more questions. Thank them warmly for sharing such beautiful memories of ${petName} and confirm that you have everything you need to create a wonderful, heartfelt storybook. End the conversation gracefully.`;
  } else if (userMessageCount >= 10) {
    prompt += `\n\nIMPORTANT: You now have plenty of wonderful material about ${petName}. In your next response, warmly wrap up the interview. Let them know you've gathered beautiful stories and have everything needed to create an amazing book about ${petName}. You may ask ONE final question at most, but focus on wrapping up.`;
  } else if (userMessageCount >= 8) {
    prompt += `\n\nNote: You're getting close to having enough material. Start thinking about wrapping up in the next few exchanges. After gathering enough rich material (~8-12 exchanges), gently let them know you have wonderful material for the story.`;
  }

  prompt += `\n\nCurrent exchange count: ${userMessageCount} user messages so far.`;
  return prompt;
}

function windowMessages(messages: { role: string; content: string }[]): { role: string; content: string }[] {
  if (messages.length <= 20) return messages;

  const early = messages.slice(0, 6);
  const recent = messages.slice(-14);

  const summaryInstruction = {
    role: "system" as const,
    content: `[The conversation has been ongoing. Here are the first few exchanges for context, followed by the most recent messages. The middle portion has been omitted to save space, but assume a natural flowing conversation occurred between these segments.]`,
  };

  return [...early, summaryInstruction, ...recent];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, petName, petType, userMessageCount = 0, photoCaptions, photoContextBrief, productType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`Interview chat for ${petName} (${petType}), ${messages.length} messages, ${userMessageCount} user msgs${photoContextBrief ? " [rich context]" : ""}`);

    const systemContent = buildSystemPrompt(petName, petType, userMessageCount, photoCaptions, photoContextBrief, productType);
    const windowedMessages = windowMessages(messages);

    console.log(`Windowed to ${windowedMessages.length} messages (from ${messages.length})`);

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
          ...windowedMessages,
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
