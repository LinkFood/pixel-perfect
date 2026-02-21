

# Tap-Through Conversational Flow for PhotoRabbit

## What Changes

Transform the post-upload experience from a blank text box into a guided, tappable conversation where Rabbit surfaces what it sees in the photos, then walks the user through format, mood, and length choices via bubble taps -- with typing as an optional escape hatch, never the default.

---

## Step 1: Rabbit Surfaces Photo Analysis as Conversational Opener

**Problem:** After photo captioning completes, Rabbit says "Done studying! I know them well now." but never tells the user WHAT it saw. The user stares at a blank input with no guidance.

**Solution:** When captioning finishes, Rabbit composes a conversational summary from the `ai_analysis` data and presents it as a chat message, then immediately offers the first decision bubbles.

**File: `src/pages/PhotoRabbit.tsx`**

Modify the captioning-complete effect (around line 930-932) that currently says "Done studying!" to instead:

1. Read the first captioned photo's `ai_analysis` (already available in `photos` state).
2. Build a natural-language summary: e.g. "I see a golden retriever in the backyard, ears up, tail going. Looks like someone just said the W word. What do you want to make?"
3. Inject this as a rabbit chat message.
4. Immediately set `quickReplies` to the first decision tier: format choices.

The summary builder is a pure function that takes `ai_analysis` objects and returns a 1-2 sentence conversational description. It focuses on `scene_summary`, `subject_type`, `subject_mood`, and picks one `notable_detail` for flavor.

**New helper:** `buildPhotoSummary(analyses: Record<string, unknown>[]): string` in `src/lib/photoSummary.ts`

Example outputs:
- 1 photo: "I see a golden retriever stretched out on a patio — ears flopped, tail mid-wag. Looks like peak relaxation mode."
- 3 photos: "I see a golden retriever in three different adventures — patio chillin', park zoomies, and what looks like a sock heist in progress."
- People: "I see two people on a beach at sunset — someone's laughing and someone's pretending they're not about to get splashed."

---

## Step 2: Build the Bubble Response System

**Problem:** Quick-reply chips only exist during the interview phase and are static keyword-matched suggestions. There's no concept of "decision bubbles" that guide the user through structured choices.

**Solution:** Introduce a new `decisionBubbles` state in `PhotoRabbitInner` that works alongside but distinct from `quickReplies`. Decision bubbles are structured choices (format, mood, length) that drive the flow. Quick replies remain for interview question responses.

**File: `src/pages/PhotoRabbit.tsx`**

Add state:
```
const [decisionBubbles, setDecisionBubbles] = useState<Array<{
  label: string;
  value: string;
  emoji?: string;
}>>([]);
```

Render decision bubbles in the chat panel (near line 1282 where quick-reply chips are rendered) with a similar but visually distinct style -- slightly larger, more prominent, with emoji prefixes.

When a decision bubble is tapped:
1. Add the label as a user message to chat
2. Clear the bubbles
3. Advance to the next decision tier
4. Rabbit responds with the next question + new bubbles

---

## Step 3: Wire Up the Full Decision Tree

The conversation flows through these tiers after photo analysis:

### Tier 1: Format (shown after photo analysis summary)

Rabbit: "[photo summary]. What do you want to make?"

Bubbles:
- "One stunning illustration" -> sets productType to `single_illustration`
- "A short story" -> sets productType to `short_story`
- "A full picture book" -> sets productType to `picture_book`

### Tier 2: Mood (shown after format choice)

Rabbit: "Nice. What's the vibe?"

Bubbles:
- "Make it funny" -> mood = `funny`
- "Make it heartfelt" -> mood = `heartfelt`
- "Tell an adventure" -> mood = `adventure`
- "Honor their memory" -> mood = `memorial`

### Tier 3: Length (shown after mood choice, only for picture_book)

Rabbit: "How big should we go?"

Bubbles:
- "Short and sweet (4 pages)" -> sets a `pageTarget` metadata
- "Just right (8 pages)" -> sets a `pageTarget` metadata
- "The full thing (12+ pages)" -> sets a `pageTarget` metadata

For `single_illustration` and `short_story`, skip this tier.

### Tier 4: Optional Context (shown after length or mood for non-book types)

Rabbit: "Any names or details I should know? (skip is fine)"

Bubbles:
- "Skip -- you've got this" -> proceed directly to generation
- "Let me add some context" -> clear bubbles, focus text input

### Then: Auto-trigger Generation

After the final tier completes, Rabbit says "On it!" and triggers `handleFinishInterview(true)` (the existing quick-generate path).

**Implementation in `src/pages/PhotoRabbit.tsx`:**

Add a `decisionTier` state (`"format" | "mood" | "length" | "context" | null`) that tracks where in the tree the user is. A `handleDecisionBubbleTap(value: string)` function processes taps:

1. Reads current `decisionTier`
2. Updates project state (product_type, mood, etc.) via existing mutations
3. Adds rabbit response message
4. Sets next tier's bubbles (or triggers generation)

This replaces the current `handleContinueToInterview` -> `startInterview` flow. Instead of going through the MoodPicker component and then the interview, the user taps through decisions in chat and goes straight to generation.

**Key integration points:**
- `handleContinueToInterview` (line 541): Instead of auto-setting heartfelt mood and jumping to interview, show Tier 1 bubbles
- The appearance profile build still fires in background during this flow
- The existing `handleFinishInterview(skipNameCheck=true)` path is reused for the final generation trigger
- Subject name is extracted from `ai_analysis` (existing code at line 553-561) or asked in Tier 4

---

## Step 4: Fix Generation to Respect Length Choice (deferred per instructions)

Not implemented in this phase. The user's instruction says "Do not start with step 4 or 5 until the tap-through conversation flow is working end to end."

However, the `pageTarget` metadata will be saved to the project so it's ready for the generation step when we wire it.

---

## Step 5: Auto-populate AI-Generated Title (deferred per instructions)

Same -- deferred. But the infrastructure (extracting title from `generate-story` response) is already partially in place.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/photoSummary.ts` | Pure function to build conversational photo analysis summary from `ai_analysis` objects |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/PhotoRabbit.tsx` | Add `decisionBubbles` + `decisionTier` state; new `handleDecisionBubbleTap` handler; modify captioning-complete effect to show photo summary + format bubbles; render decision bubbles in chat panel; modify `handleContinueToInterview` to use bubble flow instead of direct mood-set |
| `src/hooks/useProject.ts` | (Possibly) add `page_target` to the Project type if we want to persist length choice |

## What Gets Removed/Bypassed

- The `MoodPicker` component is no longer shown as a separate phase -- mood is selected via chat bubbles. The component remains available for the "change vibe" override link in the sidebar.
- The `mood-picker` phase in the flow becomes a pass-through (auto-set from bubble choice).
- The `showSpeedChoice` sticky bar ("Make it now / Tell me first") is replaced by the decision tree itself -- the entire flow IS the "make it now" path, with an opt-in to add more context at Tier 4.

## What Stays the Same

- The interview system (useInterview, interview-chat edge function) remains fully available for users who tap "Let me add some context" in Tier 4
- All existing generation logic (generate-story, generate-illustration) untouched
- BookReview, PDF generation, sharing -- all untouched
- The preview illustration that fires during upload phase -- stays
- Credit gating logic -- stays

## Technical Considerations

- Decision bubbles should be visually distinct from interview quick-reply chips (bigger, emoji-prefixed, more button-like)
- The flow should work on mobile (stacked layout) -- bubbles wrap naturally
- If the user types something during the decision tree (instead of tapping), apply intent detection to figure out what they meant and advance accordingly
- The `appearanceProfilePromise` background build needs to be triggered at the right moment -- ideally when format is chosen (Tier 1 tap), so it has time to complete before generation

