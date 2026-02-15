
# Fix: Inline Mood Flow Missing Name Input + Always-On Dev Bar

## Problems Found (tested end-to-end)

1. **The inline chat mood picker skips the name question entirely.** When a user clicks "That's all my photos -- let's go!", the chat shows mood buttons (Funny, Heartfelt, etc.) but never asks "Who is this about?" The code at line 814 passes `project?.pet_name || "New Project"` -- which is always "New Project" since `useCreateMinimalProject` hard-codes that default. The rabbit then says "Tell me about New Project" which feels broken.

2. **DevStatusBar only shows in dev mode** (`?dev=1`). During active development this should always be visible so you can see what phase/status the app thinks it's in.

3. **Photo thumbnails flash blank on first load** before storage URLs resolve. Minor but noticeable.

---

## Fix 1: Add Name Input to the Inline Chat Mood Flow

### File: `src/pages/PhotoRabbit.tsx`

**Before the mood buttons appear, inject a name-input step into the chat flow.**

Current flow:
```text
User clicks "That's all my photos"
  -> Chat shows mood buttons immediately
  -> User picks mood
  -> handleMoodSelect(mood, "New Project")  // BUG: always "New Project"
```

New flow:
```text
User clicks "That's all my photos"
  -> Chat asks: "Love these! Who's the star of this book?"
  -> User types a name (e.g. "Charlie")
  -> Chat shows mood buttons
  -> User picks mood
  -> handleMoodSelect(mood, "Charlie")  // Correct name
```

Changes:
- Add a new state `chatNamePending` (boolean) and `pendingPetName` (string)
- In `handleContinueToInterview`: instead of showing mood buttons first, inject a rabbit message asking for the name, and set `chatNamePending = true`
- When user sends a message while `chatNamePending` is true, capture it as the pet name, set `pendingPetName`, clear `chatNamePending`, then show the mood buttons
- When mood is selected (line 814), use `pendingPetName` instead of `project?.pet_name || "New Project"`

### File: `src/pages/PhotoRabbit.tsx` (chat send handler)

- In the `handleSendMessage` function, add a check at the top: if `chatNamePending` is true, treat the user's input as the name, store it, show the mood picker, and return early (don't send to the interview-chat edge function)

---

## Fix 2: Show DevStatusBar Always During Development

### File: `src/components/workspace/DevStatusBar.tsx`

- Remove the `isDevMode()` check (or make the bar always render but with a subtle style when not in dev mode)
- During active development, the bar should always be visible at the top of the workspace showing: phase, db status, mood, photo count, project ID

---

## Fix 3: Photo Thumbnail Loading

### File: `src/components/workspace/PhotoUploadInline.tsx`

- Add a loading/skeleton state for photo thumbnails while storage URLs are being resolved
- Use `onLoad` / `onError` handlers on img tags to transition from skeleton to loaded state

---

## Summary

| File | Change |
|------|--------|
| `src/pages/PhotoRabbit.tsx` | Add name-input step before mood picker in inline chat flow. Use captured name instead of "New Project". |
| `src/components/workspace/DevStatusBar.tsx` | Always show during development (remove dev-mode-only gate). |
| `src/components/workspace/PhotoUploadInline.tsx` | Add skeleton loading state for photo thumbnails. |
