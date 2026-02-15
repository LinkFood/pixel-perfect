

# Fix: Chat Bubbles, Mood Flow, and Layout Stability

## Problem 1: Chat bubbles look like block text (not iMessage)

The rabbit's bubble color (`bg-secondary` = warm gray 95%) is almost identical to the page background (warm white 98.5%). There's essentially no contrast -- the bubble disappears into the page.

**Fix:**
- Give rabbit bubbles a visible background: `bg-[hsl(var(--chat-ai-bg))]` with a subtle border (`border border-[hsl(var(--chat-ai-border))]`) -- these CSS tokens already exist but aren't being used
- Give user bubbles the coral primary color (already correct)
- Add slightly more padding and a subtle shadow to both bubble types to create the "floating bubble" effect
- Increase max-width from 82% to 78% so bubbles don't stretch wall-to-wall

**File: `src/components/workspace/ChatMessage.tsx`**

## Problem 2: Mood picker is invisible / flow freezes

The bug flow:
1. User clicks "That's all my photos -- let's go!"
2. `handleContinueToInterview` sets project status to `"interview"`
3. Phase derivation sees `!project.mood` is true, so phase becomes `"mood-picker"`
4. MoodPicker renders in the **right panel** (WorkspaceSandbox), but the user is staring at the **left panel** (chat) where nothing changes -- it looks frozen
5. When user clicks "Make it funny" in the right panel, `handleMoodSelect` fires correctly, but if the mutation is slow, the UI appears stuck

**Fix:**
- Move mood selection INTO the chat flow as inline tappable bubbles, so the rabbit asks "what's the vibe?" directly in the conversation
- When the user taps a mood bubble in chat, it calls `handleMoodSelect` directly
- Remove the separate MoodPicker panel from WorkspaceSandbox for this phase
- This makes the flow: photos drop -> rabbit reacts -> "what's the vibe?" with inline mood buttons -> interview begins
- The right panel (workspace) stays showing the uploaded photos the whole time -- no page jump

**Files: `src/pages/PhotoRabbit.tsx`, `src/components/workspace/ChatMessage.tsx`, `src/components/workspace/WorkspaceSandbox.tsx`**

## Problem 3: Layout jumps / pages move around

Currently the right panel (WorkspaceSandbox) swaps its entire content between phases (upload grid, mood picker, interview strip, generation view, book review) using AnimatePresence. This causes the "page movement" feeling.

**Fix:**
- During upload and interview phases, keep the photo grid always visible in the right panel
- Remove the mood-picker case from WorkspaceSandbox (it's now inline in chat)
- The right panel only changes content for `generating` and `review` phases (which are genuinely different views)

**File: `src/components/workspace/WorkspaceSandbox.tsx`**

---

## Technical Details

### ChatMessage.tsx changes
- Rabbit bubbles: `bg-[hsl(var(--chat-ai-bg))] border border-[hsl(var(--chat-ai-border))] shadow-chat` with `rounded-2xl rounded-bl-md`
- User bubbles: `bg-primary text-primary-foreground shadow-chat` with `rounded-2xl rounded-br-md`
- Both get `px-4 py-3` padding (slightly more vertical breathing room)
- Max width reduced to `max-w-[78%]`

### Inline mood picker in chat
- New `ChatMessage` variant that accepts `children` prop (already supported) to render mood buttons inline
- When phase becomes `mood-picker`, the rabbit posts a greeting with 4 tappable mood pill buttons below it
- Each pill is styled as a rounded capsule with the mood icon + label
- Tapping one calls `handleMoodSelect(mood, petName)` and transitions to interview
- A name input appears inline above the mood pills if name is still "New Project"

### WorkspaceSandbox changes
- Remove the `phase === "mood-picker"` block entirely
- During `interview` phase, show the full photo grid (same as upload view) instead of just a collapsible strip -- photos stay visible as context while chatting
- The "That's all my photos" button and "Make my book" button remain in the right panel

### PhotoRabbit.tsx changes
- When `handleContinueToInterview` fires and mood is not set, instead of silently setting status to interview, inject a rabbit chat message with inline mood selection buttons
- Add a `chatMoodPending` state that tracks whether we're waiting for mood selection in chat
- When mood is selected via chat pill, call existing `handleMoodSelect` which transitions to interview

