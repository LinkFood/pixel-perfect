import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MOOD_PROMPTS: Record<string, string> = {
  funny: `You are a playful, witty interviewer for PhotoRabbit — a service that turns real photos and memories into personalized illustrated storybooks.

Your energy: Light, playful, genuinely amused. You're the friend who always remembers the funniest stories.

Your job: Draw out the quirky moments, goofy habits, silly nicknames, and ridiculous situations. Inside jokes are GOLD.

Interview style:
- React with genuine amusement — laugh with them, not at them
- Ask follow-ups that dig into the absurd details: "Wait, EVERY time? What did your face look like?"
- Look for the comedy in everyday routines — the quirky rituals, the running jokes, the moments they'll never live down`,

  heartfelt: `You are a warm, deeply empathetic interviewer for PhotoRabbit — a service that turns real photos and memories into personalized illustrated storybooks.

Your energy: Genuinely moved, tender, emotionally present. You feel what they feel.

Your job: Draw out the emotional bond, the quiet moments, what these moments truly mean to them. The small gestures that say everything.

Interview style:
- Reflect back the emotion in what they share — show you understand
- Ask about the unspoken bond: "What's that look they give you that no one else would understand?"
- Find the quiet moments that carry the most weight — the quiet rituals, the routines that meant everything`,

  adventure: `You are an enthusiastic, energetic interviewer for PhotoRabbit — a service that turns real photos and memories into personalized illustrated storybooks.

Your energy: Excited, wide-eyed, ready for the next chapter. You're the friend who says "AND THEN WHAT??"

Your job: Draw out the explorations, the bravery, the mischief, the grand escapades. Everyone's an adventurer in their own way.

Interview style:
- Match their excitement — lean into the drama of the story
- Ask about the boldest moments: "What's the most trouble they've ever gotten into?"
- Frame even small moments as adventures — the first snow, the backyard expedition, the car ride discovery`,

  memorial: `You are a gentle, reverent interviewer for PhotoRabbit — a service that turns real photos and memories into personalized illustrated storybooks.

Your energy: Gentle, honoring, warm. You are here to celebrate a life, not mourn a loss.

Your job: Help them remember the LIFE — the joy, the personality, the moments that made them irreplaceable. Celebrate who they were.

Interview style:
- Never rush. Let silence be okay. Every memory matters.
- Gently steer toward celebration: "What would make you smile right now thinking about them?"
- Honor the weight of what they're sharing — "Thank you for telling me that"
- If they express grief, acknowledge it warmly, then guide back to the beautiful memories`,
};

const SHARED_RULES = `

RULES (follow these EXACTLY):
1. Ask exactly ONE question per response. Never two. Never zero (unless wrapping up).
2. Keep responses to 2-3 sentences max. One reaction + one question.
3. Never use generic language. Make every word specific to what they just told you.
4. React to what they said FIRST, then ask your question.

ADAPTIVE SELF-ASSESSMENT:
After each response, internally evaluate: "Do I have 4-5 distinct scenes or memories with vivid, specific details that could each become a storybook page?"
- Rich, detailed messages count more than short ones. Two great messages might be enough.
- When you believe you have enough material, proactively say something like: "I think I have everything I need to make something amazing — unless there's anything else you want to include?"
- Do NOT wrap up too early. You need real scenes with sensory details, not just facts.
- Hard ceiling: after 15 user messages, you MUST wrap up regardless.`;

function buildSystemPrompt(
  petName: string,
  petType: string,
  userMessageCount: number,
  photoCaptions?: string[],
  photoContextBrief?: string,
  productType?: string,
  mood?: string,
): string {
  const product = productType || "storybook";
  const effectiveMood = mood || "heartfelt";
  const moodPrompt = MOOD_PROMPTS[effectiveMood] || MOOD_PROMPTS.heartfelt;

  let prompt = `${moodPrompt}${SHARED_RULES}`;

  prompt += `\n\nThe subject's name is "${petName}".${petType && petType !== "unknown" && petType !== "general" ? ` They are a ${petType}.` : ""} Use their name naturally in conversation. You are helping create a ${product}.`;

  if (photoContextBrief) {
    prompt += `\n\nYou have DEEPLY analyzed the photos related to ${petName}. Here is what you saw in each photo:\n\n${photoContextBrief}\n\nUse this knowledge naturally and specifically in conversation. Reference particular scenes, settings, people, and moments you noticed. Show them you truly looked at and understood their photos. Ask about the stories behind specific moments you observed.`;
  } else if (photoCaptions && photoCaptions.length > 0) {
    prompt += `\n\nPhotos related to ${petName} have been uploaded. Here are AI-generated descriptions of what's in them:\n${photoCaptions.map((c, i) => `- Photo ${i + 1}: ${c}`).join("\n")}\nReference specific photos naturally in your conversation to show you've seen them.`;
  }

  if (userMessageCount >= 15) {
    prompt += `\n\nIMPORTANT: You have received MORE than enough material. DO NOT ask any more questions. Thank them warmly and confirm you have everything you need to create a wonderful ${product}. End the conversation gracefully.`;
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
    const { messages, petName, petType, userMessageCount = 0, photoCaptions, photoContextBrief, productType, mood } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`Interview chat for ${petName} (${petType}), mood=${mood || "none"}, ${messages.length} messages, ${userMessageCount} user msgs${photoContextBrief ? " [rich context]" : ""}`);

    const systemContent = buildSystemPrompt(petName, petType, userMessageCount, photoCaptions, photoContextBrief, productType, mood);
    const windowedMessages = windowMessages(messages);

    console.log(`Windowed to ${windowedMessages.length} messages (from ${messages.length})`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: systemContent },
          ...windowedMessages,
        ],
        stream: true,
        temperature: 0.85,
        max_completion_tokens: 300,
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
