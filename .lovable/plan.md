
# Root Cause Found — Three Specific Bugs

## What's Actually Broken (Line Numbers in Code)

### Bug 1: Intent regex is too narrow (line 361)

The current regex:
```
/\b(make it now|just make|make the book|create it|generate|let'?s go|go for it|just do it|make it|do it now|build it|start it|make my book|just start|make it please)\b/i
```

The user typed: **"make a short story about a baby going to a baseball game and he catches a ball"**

This does NOT match. Why? Because `"make a"` isn't in the list — only `"make it"` is. The regex requires a very specific two-word combo. Someone saying "make a story" or "make me a book" or "write me a story" or "create a story" gets zero detection.

### Bug 2: Sticky bar only shows for `phase === "interview"` (line 1086)

```tsx
{showSpeedChoice && phase === "interview" && (
```

But in this session, `phase` is **`"upload"`** the entire time the user is chatting. The project status is `"upload"`, no mood is set, so `phase` never becomes `"interview"`. The sticky bar is gated behind a phase that never arrives.

### Bug 3: The speed-choice `useEffect` only triggers on `phase` becoming `"interview"` (line 741-746)

```typescript
useEffect(() => {
  if (phase !== "interview") return; // ← never fires if phase stays "upload"
  if (speedChoiceShownRef.current) return;
  speedChoiceShownRef.current = true;
  setShowSpeedChoice(true);
}, [phase]);
```

So `setShowSpeedChoice(true)` is never called. Buttons never show.

### The Overall Result

User uploads a photo → chats in upload phase → AI treats every message as an interview question → no buttons appear → no way to escape → trapped in conversation.

---

## The Fixes

### Fix 1 — Expand the intent regex to catch natural language

Replace the narrow two-word combos with a broader pattern that catches what real users type:

```typescript
const intentKeywords = /\b(make|create|write|generate|build|start)\b.{0,30}\b(book|story|it|this|now|page|pages)\b|\b(just do it|go for it|let'?s go|make it now|make my book|just start|do it now)\b/i;
```

This catches:
- "make a story" ✓
- "make a short story" ✓  
- "create a book" ✓
- "write me a story about a dog" ✓
- "generate it" ✓
- "just make it" ✓
- "go for it" ✓

And correctly rejects:
- "make sure you have the right photos" — has `make` but no story/book/it/now within 30 chars
- "create a name for him" — has `create` but no book/story keyword following

### Fix 2 — Show the sticky bar during upload phase too

Change line 1086 from:
```tsx
{showSpeedChoice && phase === "interview" && (
```
to:
```tsx
{showSpeedChoice && (phase === "interview" || phase === "upload") && (
```

And update the `useEffect` trigger to also fire on upload phase:
```typescript
useEffect(() => {
  if (phase !== "interview" && phase !== "upload") return;
  if (speedChoiceShownRef.current) return;
  if (photos.length === 0) return; // Only show if there are photos to work with
  speedChoiceShownRef.current = true;
  setShowSpeedChoice(true);
}, [phase, photos.length]);
```

This way, as soon as the user has photos and is chatting in upload phase, the sticky bar appears. No need to wait for the phase to become "interview".

### Fix 3 — Reset `speedChoiceShownRef` when photos arrive (for new projects)

When a new photo is uploaded and the ref is already `true` from a previous project, the buttons never appear. Reset on photo count change from 0 to first photo:

```typescript
const prevPhotoCountRef2 = useRef(0);
useEffect(() => {
  if (photos.length > 0 && prevPhotoCountRef2.current === 0) {
    // First photo arrived — reset so speed choice can show
    speedChoiceShownRef.current = false;
    setShowSpeedChoice(false);
  }
  prevPhotoCountRef2.current = photos.length;
}, [photos.length]);
```

Actually simpler: just handle this inside the existing `useEffect` by checking `photos.length === 0` as a guard (already in Fix 2 above).

### Fix 4 — Button label clarity

When showing during upload phase, change button wording slightly so it makes sense before the interview starts:

- "⚡ Make it now — let AI decide" (clear: AI uses the photos, no questions asked)
- "💬 Tell me first" (clear: we'll go through the interview)

### Fix 5 — handleQuickGenerate needs a mood when called from upload phase

Currently `handleQuickGenerate` calls `handleFinishInterview()` which checks for a mood. If no mood is set (upload phase), it'll get blocked. The same logic as in `handleSend` intent detection needs to be used — default to `"heartfelt"` and set the mood before calling finish:

```typescript
const handleQuickGenerate = async () => {
  setShowSpeedChoice(false);
  if (!project?.mood) {
    // No mood yet — default to heartfelt, then generate
    const nameToUse = project?.pet_name && project.pet_name !== "New Project" 
      ? project.pet_name 
      : pendingPetName || "your subject";
    await updateProject.mutateAsync({ 
      id: activeProjectId!, 
      mood: "heartfelt", 
      pet_name: nameToUse 
    });
    startInterview("heartfelt");
    setTimeout(() => handleFinishInterview(), 300);
  } else {
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: `I've studied every photo. Watch me go! ⚡`,
    }]);
    scrollToBottom();
    handleFinishInterview();
  }
};
```

---

## Files to Change

| File | Lines | What Changes |
|------|-------|------|
| `src/pages/PhotoRabbit.tsx` | 361 | Expand intent regex to catch "make a story", "write a book", etc. |
| `src/pages/PhotoRabbit.tsx` | 741-746 | Update useEffect to trigger on `upload` phase when photos exist |
| `src/pages/PhotoRabbit.tsx` | 657-665 | Update `handleQuickGenerate` to handle no-mood case |
| `src/pages/PhotoRabbit.tsx` | 1086 | Show sticky bar during `upload` phase, not just `interview` |

No edge function changes. No database changes. Pure client-side logic.

---

## What the User Sees After the Fix

```
User uploads 1 photo
  → Rabbit: "I see: 'A joyful baby...' — add more or continue."
  → [sticky bar appears immediately above input]
    [ ⚡ Make it now — let AI decide ]  [ 💬 Tell me first ]

User types anything at all in the chat
  → The sticky bar remains visible above the input

User types "make a short story about a baby at a baseball game"
  → Intent detected → rabbit: "Got it — making it now! ⚡"
  → Generation starts immediately

User clicks "⚡ Make it now"  
  → Book generates from photo analysis alone, no questions asked
```

The key insight: the sticky bar must appear as soon as the user has photos, regardless of what phase the project is in.
