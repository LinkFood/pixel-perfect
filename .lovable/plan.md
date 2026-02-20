
# Root Cause: Wrong Phase When User Types

## What's Actually Happening (From the Screenshots)

Looking at the screenshots in sequence:

1. User is in **upload phase** — one photo uploaded, rabbit shows a caption preview
2. User types: **"make a short story 4 pages of a baby going to a baseball game make it funny"**
3. Rabbit enters interview mode and starts asking about "slapstick vs. inner monologue"
4. User answers: "popcorn" → Rabbit asks ANOTHER question
5. User answers: "mascot make it joining in" → Rabbit asks ANOTHER question
6. User answers: "that sounds good" → Rabbit asks ANOTHER question
7. User answers → still no book

The "⚡ Make it now" buttons **never appear** because:

- `showSpeedChoice` only becomes true when `phase === "interview"` AND `userInterviewCount === 0`
- But in this session the user typed their **very first message while still in the upload phase** (before clicking "That's all my photos")
- So by the time `phase` switches to `"interview"`, `userInterviewCount` is already > 0
- The effect guards against exactly this with `if (userInterviewCount > 0) return;` — which blocks the buttons from ever showing

**Result: buttons never appear, user is trapped in an endless interview.**

The "New Project" bug is also still active — the name capture prompt never fired because `handleContinueToInterview()` was never called.

---

## The Two Real Problems to Fix

### Problem 1: Speed choice must appear BEFORE the user types — or not at all

The current design assumes the user waits silently for the rabbit to speak, then sees the buttons, then chooses. But real users type immediately. The buttons need to be **always visible** at the start of an interview — not conditionally injected after detecting message patterns.

**Fix:** Move the two speed-choice buttons OUT of the chat message list and INTO a persistent sticky banner or header area at the top of the chat panel, shown whenever:
- `phase === "interview"` AND
- `userInterviewCount === 0` AND
- `showSpeedChoice` is true (before either button is clicked)

This way the buttons are visible even if the user has already typed — they show above the existing messages, not inline after a specific message.

Alternatively (simpler and cleaner): show the buttons right after the rabbit's opening greeting as a **persistent element that stays visible** even as the user scrolls/types — not one that vanishes when a new message is added.

### Problem 2: When the user types their intent into the chat ("make a funny 4 page book"), the rabbit should HONOR IT

When the user sends a message like "make a short story 4 pages of a baby going to a baseball game make it funny" in the upload phase or early interview, the system should detect this as an intent to generate and short-circuit the interview.

**Fix:** Add a simple intent-detection layer in `handleSend`. If the message contains generation-intent keywords ("make", "create", "generate", "just make it", "let's go", etc.) AND we have photos AND the user hasn't been through much interview yet (`userInterviewCount <= 1`), the rabbit should say "Got it — making it now!" and call `handleFinishInterview()` directly.

This is much more natural than requiring the user to click a specific button.

---

## The Plan

### Change 1: Make speed-choice buttons a sticky persistent element (not inline)

Remove the current inline button injection from the `chatMessages.map()` loop (the `i === chatMessages.findIndex(...)` condition). Instead, render the buttons as a fixed element **above the chat input** or as a sticky notice at the top of the messages area.

They should show when `showSpeedChoice && phase === "interview"` — period. No dependency on which message index we're at.

Change the `showSpeedChoice` useEffect to drop the `userInterviewCount > 0` guard:
```typescript
useEffect(() => {
  if (phase !== "interview") return;
  if (speedChoiceShownRef.current) return;
  // Show as soon as we enter interview phase — regardless of message count
  speedChoiceShownRef.current = true;
  setShowSpeedChoice(true);
}, [phase]);
```
This fires the moment `phase` becomes `"interview"`, even if the user has already sent messages. The buttons appear above the input as a visible choice regardless of what's in the chat.

The sticky button block renders above the `ChatInput` at the bottom of the chat panel, visible and persistent until one is clicked:

```tsx
{showSpeedChoice && phase === "interview" && (
  <div className="px-4 py-2 border-t border-border/40 bg-background/80 flex gap-2 flex-wrap">
    <button onClick={handleQuickGenerate}>⚡ Make it now</button>
    <button onClick={() => setShowSpeedChoice(false)}>💬 Keep chatting</button>
  </div>
)}
<ChatInput ... />
```

### Change 2: Intent detection on user send

In `handleSend`, before calling `sendMessage`, check if the user's text signals generation intent AND conditions are right for quick generation:

```typescript
const intentKeywords = /\b(make it|make the book|just make|create it|generate|let's go|go for it|make it now|just do it)\b/i;
const isQuickIntent = intentKeywords.test(text) && photos.length >= 1 && !isFinishing;

if (isQuickIntent && phase === "interview" && userInterviewCount <= 1) {
  setChatMessages(prev => [...prev, { role: "rabbit", content: "Got it — making it now! ⚡" }]);
  handleFinishInterview();
  return;
}
```

This means if the user types "just make it" or "go for it" or similar into the chat at any point early in the interview, the rabbit acts on it immediately.

### Change 3: Fix "New Project" name — intercept it earlier

The name capture currently only fires through `handleContinueToInterview()`. But when a user skips straight to chat (as in this session), they never hit that flow.

**Fix:** In `handleSend`, when `phase === "upload"` and the project name is "New Project" and the user is sending their first message (photos are present), treat the message as the subject name — OR show a name capture before passing to the AI.

Actually better: in the greeting injection for upload phase when photos exist, explicitly prompt for the name right there:

```typescript
// In the photo greeting, when project name is still "New Project"
if (project?.pet_name === "New Project" || !project?.pet_name) {
  setChatNamePending(true); // intercept next message as name
  greeting = `I see ${photos.length} photo${photos.length !== 1 ? "s" : ""}! First — who's the star of this book?`;
}
```

This way, the VERY FIRST message the user types after photos are uploaded is captured as the name, before any AI call is made.

---

## Files to Change

| File | What Changes |
|------|------|
| `src/pages/PhotoRabbit.tsx` | (1) Move speed-choice buttons to sticky position above ChatInput; (2) Simplify showSpeedChoice useEffect to fire on phase change only; (3) Add intent detection in handleSend; (4) Fix name capture to fire earlier in photo greeting |

No edge function changes needed. No database changes. Pure UI logic fixes.

---

## What This Looks Like After the Fix

```
User uploads photo
  → Rabbit: "Who's the star of this book?" [name capture active]
  → User types: "Leo"
  → Rabbit: "Leo — love it! What's the vibe?"
  → Mood picker buttons appear
  → User picks "Funny"
  → Interview phase starts
  → [sticky bar appears at bottom of chat, above input]
    [ ⚡ Make it now ]  [ 💬 Keep chatting ]
  → User can see buttons immediately, even before rabbit greets them
  → If user types "just make it" → book generates
  → If user types normally → interview continues, buttons stay visible
  → If user clicks "Make it now" → book generates
  → If user clicks "Keep chatting" → buttons disappear, normal interview
```
