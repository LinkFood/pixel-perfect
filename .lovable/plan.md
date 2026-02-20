
# Bug: Wrong Project's Preview Illustration Showing

## What's Happening

When you upload a photo to a new project ("Untitled"), the chat shows a preview illustration from your PREVIOUS project ("Jac goes to the ball park") instead of a fresh illustration for the new photo.

## Root Cause

There are two refs used as guards in the chat:

- `greetingInjectedRef` — reset to `null` when the project switches (line 842) ✓ correct
- `previewTriggeredRef` — **never reset when the project switches** ✗ this is the bug

Here is the exact sequence of events causing the wrong preview to appear:

```text
1. User is on "Jac goes to the ball park"
   → previewTriggeredRef.current = "jac-project-id"
   → chatMessages has a rabbit message with the Jac preview photo

2. User clicks "New Project" or creates Untitled
   → activeProjectId changes to "untitled-project-id"
   → greetingInjectedRef is reset → greeting effect fires → setChatMessages([greeting])
   → chatMessages is now just [{ role: "rabbit", content: "Ready when you are..." }]

3. User uploads dog+baby photo → caption arrives

4. Preview effect fires:
   → previewTriggeredRef.current = "jac-project-id" (NEVER RESET)
   → activeProjectId = "untitled-project-id"
   → "jac-project-id" !== "untitled-project-id" → PASSES THE GUARD
   → previewTriggeredRef.current = "untitled-project-id" (set to new ID)
   → generatePreview() is called for the correct new project

5. The async edge function runs... but MEANWHILE the component re-renders
   several times as photos load, captions arrive, etc.

6. On one of these re-renders, there's a brief window where chatMessages
   still has the OLD photo message from the Jac project (before the greeting
   reset fully propagated through React's batch). The dedup guard sees it
   and returns early — OR the edge function returns but stores over the
   old preview storage path incorrectly.

   MORE LIKELY: The edge function is called, succeeds, returns the new URL,
   but the setChatMessages updater finds a photos message already in state
   (leftover from the previous project that wasn't fully cleared) and
   SKIPS adding the new one — leaving the old image visible.
```

The simplest explanation is: **`previewTriggeredRef` is not reset on project switch**, so when the new project's photos arrive, it may fire with stale timing against a `chatMessages` state that briefly still has the old project's preview photo — and the dedup guard incorrectly blocks the new preview.

There's also a secondary scenario: the effect fires on the NEW project, generates a real NEW preview, but by the time the `setChatMessages` updater runs, the dedup guard finds an old photo message from the previous project still in state and returns early (showing nothing). Then the user sees whatever was last in chat — the old image.

## The Fix — Two Changes in `src/pages/PhotoRabbit.tsx`

### Change 1: Reset `previewTriggeredRef` when switching projects

Add a reset for `previewTriggeredRef` alongside the existing `greetingInjectedRef` reset. This is the primary fix.

```typescript
// EXISTING (line 841-844):
useEffect(() => {
  greetingInjectedRef.current = null;
}, [activeProjectId]);

// BECOMES:
useEffect(() => {
  greetingInjectedRef.current = null;
  previewTriggeredRef.current = null;   // ← ADD THIS
  prevPhotoCountRef.current = 0;         // ← ALSO RESET photo count
}, [activeProjectId]);
```

This ensures that when switching to a new project, the preview guard is cleared so a fresh preview can be generated for the new project's photos.

### Change 2: Strengthen the dedup guard with project-scoped check

The current dedup guard uses a closure-free functional updater — but it can't reference `activeProjectId` (the closure captures a stale value). We need to store the projectId alongside the preview so the guard can compare correctly.

Instead of checking only `m.photos?.length`, also tag the preview message with the project ID so the dedup guard can check it belongs to the current project:

```typescript
// When adding the preview message, tag it with the projectId
const capturedProjectId = activeProjectId; // captured at call time

setChatMessages(prev => {
  // Only block duplicates for the SAME project
  if (prev.some(m => m.role === "rabbit" && m.photos?.length && m.projectId === capturedProjectId)) return prev;
  return [...prev, {
    role: "rabbit" as const,
    content: "Here's a little taste of what your book could look like... ✨",
    photos: [data.publicUrl],
    projectId: capturedProjectId,   // ← tag with project ID
  }];
});
```

And update the `chatMessages` state type to include optional `projectId`:
```typescript
const [chatMessages, setChatMessages] = useState<Array<{
  role: "rabbit" | "user";
  content: string;
  photos?: string[];
  moodPicker?: boolean;
  projectId?: string;  // ← add this
}>>([]);
```

### Why This Is Enough

With these two changes:

- Switching projects resets the preview ref → the effect can fire cleanly for the new project
- The dedup guard checks project ID → a preview from project A can never block project B's preview from appearing
- The combination means each project gets exactly one preview, tied to that project

## File Changed

Only `src/pages/PhotoRabbit.tsx` — two small, targeted edits:
1. Add `previewTriggeredRef.current = null` and `prevPhotoCountRef.current = 0` to the project-switch reset effect
2. Capture `activeProjectId` in the preview async closure, tag preview messages with `projectId`, and update the dedup guard to compare project IDs
