
# The Real Problem: What the User Wanted vs. What the AI Got

## The Core Diagnosis (Confirmed by Database)

When you typed "make a short funny 8 page book of baby jac and his dog link going to play in the mud", this is what actually happened:

**What the generate-story function received:**

- Photo: Baby and dog on a cozy couch (that's the actual photo)
- Interview transcript: 4 messages — all about "big dark-furred dog staring at giggling baby jac on the cozy couch"
- The user's original request ("playing in the mud") was NEVER in the interview transcript

**Why?** The fast-intent path fires and goes straight to generation. Your message never gets saved to `project_interview`. The story AI only reads from `project_interview`. So it had zero information about mud — only a photo of a sofa and a rabbit interview also about a sofa.

**The photo problem:** The AI is not "too locked in" to what the photos show — it's that we're not telling it the right story. The photo is the SETTING/CHARACTER reference, not the plot. The user's intent message IS the plot — but it's being silently discarded.

This is a two-part fix:

---

## Part 1 — Save the User's Intent as the Opening Interview Entry

When the fast-intent path fires ("make a book about X doing Y"), save the user's message to `project_interview` BEFORE calling `generate-story`. That message IS the creative brief — it should absolutely be in the transcript.

Currently in `handleSend` (fast-intent path, line ~374):
```
// The user's message is added to chatMessages but never saved to project_interview
setChatMessages(prev => [...prev, { role: "user", content: text }]);
```

Fix: After extracting mood and name, insert the user's intent message into `project_interview` via Supabase:

```typescript
// Save user's intent message to interview transcript
await supabase.from("project_interview").insert({
  project_id: activeProjectId,
  role: "user",
  content: text,  // "make a short funny 8 page book of baby jac going to play in the mud"
});
// Also add a brief acknowledgment from assistant so there's context
await supabase.from("project_interview").insert({
  project_id: activeProjectId,
  role: "assistant",
  content: "Got it! I'll make a funny book about baby jac and their dog Link playing in the mud.",
});
```

This ensures that when `generate-story` reads the transcript, it has the user's actual creative direction as the foundation.

---

## Part 2 — Strengthen the Story Prompt to Honor User's Stated Intent

Add an explicit instruction to the `generate-story` system prompt and user prompt that EXPLICITLY calls out the user's stated scenario. The story AI needs to be told: "The user asked for THIS — don't let photo captions override the requested scenario."

Update `buildSystemPrompt` in `generate-story/index.ts` to add:

```
CRITICAL: The interview transcript is your PRIMARY source. If the user asked for a specific scenario (e.g., "playing in the mud"), WRITE THAT SCENARIO even if the photos show a different setting. Photos inform CHARACTER APPEARANCE only — the interview defines the STORY.
```

And update the user prompt in `generate-story` to include a parsed "story brief" extracted from the first user message:

```typescript
// Extract the user's first/intent message as the story brief
const storyBrief = interview?.find(m => m.role === "user")?.content || "";
const userPrompt = `Create a children's storybook about ${project.pet_name}${petDesc}.
${storyBrief ? `\n\nTHE USER'S CREATIVE BRIEF (HONOR THIS ABOVE ALL ELSE): "${storyBrief}"\n` : ""}
INTERVIEW TRANSCRIPT:
${transcript}
...`;
```

---

## Part 3 — The Dev Comparison Report (Your Idea — It's a Great One)

Add a "Generation Report" tab inside BookReview that's only visible in dev mode (or to the logged-in creator). It shows:

- **What the user asked for**: The first user message(s) from `project_interview`
- **What was generated**: A summary of the page `scene_description` fields
- **Inputs used**: Interview message count, photo count, mood, appearance profile (yes/no), photo context brief (yes/no)
- **Generation model and time**: From the `build_log` entries

This is already partially available — `build_log` stores metadata. We just need to surface it as a readable report.

---

## Technical Summary of All Changes

### File 1: `src/pages/PhotoRabbit.tsx`
- In the fast-intent path (lines ~374-416), after extracting name/mood, save the user's original message to `project_interview` via Supabase before calling `handleFinishInterview(true)`

### File 2: `supabase/functions/generate-story/index.ts`
- Add a CRITICAL instruction to `buildSystemPrompt`: photos are for character appearance only; the interview transcript (especially the user's stated scenario) defines the story
- In the `userPrompt`, extract and highlight the first user message as the "Creative Brief" — putting it first and in caps so the AI treats it as primary

### File 3: `src/components/project/BookReview.tsx` (new Dev Report tab)
- Add a "Generation Report" section (dev-mode only, or as a collapsible panel)
- Shows: user's stated brief, what was actually generated (scene_descriptions), and all build_log inputs
- Helps diagnose any future mismatches quickly

These three changes together solve the root problem: the AI now gets the user's actual creative intent AND is explicitly told to honor it over photo context, AND you get a report to verify it's working.
