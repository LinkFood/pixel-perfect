
# Two Bugs to Fix

## Bug 1 — Preview Illustration Appears Twice

### Root Cause

The `previewTriggeredRef` guard on line 884 sets `previewTriggeredRef.current = activeProjectId` synchronously before the async API call. This should prevent double-firing. But React's **StrictMode** in development double-invokes effects to detect side effects — this causes the effect to run twice before the ref can stop it.

More critically, there's a second path: the `greetingInjectedRef` is reset to `null` when `activeProjectId` changes (line 829). If the project ID comes in late (URL param → project loaded), this reset fires, the greeting effect runs and calls `setChatMessages([...])`, which wipes chatMessages. This causes `chatMessages.length` to be 0 again, which can cause downstream effects to re-evaluate. The `previewTriggeredRef` is separate and still set — but the async timing of caption arrival vs. component re-evaluations may result in the effect running when `previewTriggeredRef.current` was momentarily `null` (if the project switched briefly).

The fix: Track the preview trigger in **Supabase storage** or a more robust state — but the simplest fix is to store the triggered state outside the component closure using a module-level Set, OR use a Supabase flag. The simplest robust fix is to use a **persistent flag in the database** — check the `projects` table for whether we already have a preview stored, or store it as a local state that also checks for an existing preview message in `chatMessages` before adding another.

**Practical fix:** Before appending the preview message to `chatMessages`, check if one already exists:
```typescript
setChatMessages(prev => {
  // Don't add a second preview if one already exists
  const alreadyHasPreview = prev.some(m => m.photos && m.photos.length > 0 && m.role === "rabbit");
  if (alreadyHasPreview) return prev;
  return [...prev, { role: "rabbit", content: "Here's a little taste...", photos: [data.publicUrl] }];
});
```

This is a simple, bulletproof deduplication guard — even if the effect fires twice, only the first preview message gets added.

---

## Bug 2 — "Make me a funny book" Clears Chat and Gets Stuck on Name

### Root Cause — Two separate issues chain together:

**Issue A: `startInterview()` wipes the chat**  
The intent detection path (line 371–387) correctly fires when the user types a generation intent phrase in the `"upload"` phase. It then calls:
1. `setChatMessages([user message, rabbit "making it now" message])` ✓ correct
2. `startInterview("heartfelt")` — which calls `setChatMessages([greeting])` — **REPLACES the whole array with just the greeting message**

`startInterview` is designed for the mood → interview transition and always does a full `setChatMessages([...])` reset. When called from the intent detection path, it wipes the "making it now!" exchange the user just saw.

**Issue B: Name is not extracted from the user's own message**  
The user typed: *"make a short funny 8 page book of baby jac and his dog link going to play in the mud"*. The names "baby jac" and "link" are RIGHT THERE in the text. But the code uses `project?.pet_name || pendingPetName || "New Project"` — so the project gets named "New Project". Then `handleFinishInterview()` sees `pet_name === "New Project"` and intercepts to ask for the name instead of generating.

**Issue C: The mood from the message is ignored**  
The user said "funny" in their message, but the code defaults to `"heartfelt"` mood. The user's intent is clearly in the text.

### The Fix

**For the chat wipe:** Change the intent detection path to skip calling `startInterview()` entirely. Instead, just update the project status directly and call `handleFinishInterview()`. The `startInterview()` function is for the normal interview entry flow — the quick-generate path doesn't need to reset the chat to a greeting.

```typescript
// BEFORE (clears chat with startInterview):
await updateProject.mutateAsync({ id: activeProjectId!, mood: "heartfelt", pet_name: ... });
startInterview("heartfelt");
setTimeout(() => handleFinishInterview(), 300);

// AFTER (transitions directly without wiping chat):
await updateProject.mutateAsync({ id: activeProjectId!, mood: moodFromText || "heartfelt", pet_name: nameFromText || project?.pet_name || "New Project" });
await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
setTimeout(() => handleFinishInterview(), 300);
```

**For the name stuck loop:** In `handleFinishInterview()`, the check is:
```typescript
if (!project?.pet_name || project.pet_name === "New Project") {
  // ask for name...
  return; // STOPS generation
}
```

When the user's message contains explicit subject names, we should extract them OR skip the name guard if we're in a quick-generate path. The simplest fix: add a `skipNameCheck` parameter OR extract a tentative name from the user's message text before calling `handleFinishInterview`.

**For the mood:** Parse "funny" from the user's text before defaulting to "heartfelt".

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/PhotoRabbit.tsx` | (1) Fix preview dedup check — guard `setChatMessages` with existing-preview check. (2) Fix intent detection path — don't call `startInterview()`, instead update status directly, extract mood and tentative name from text. (3) Add a `skipNameCheck` flag or bypass when coming from direct intent so generation doesn't get stuck on name prompt. |

### Detailed Changes

**Fix 1 — Preview dedup (line 894):**
```typescript
setChatMessages(prev => {
  if (prev.some(m => m.role === "rabbit" && m.photos?.length)) return prev;
  return [...prev, {
    role: "rabbit" as const,
    content: "Here's a little taste of what your book could look like... ✨",
    photos: [data.publicUrl],
  }];
});
```

**Fix 2 — Intent detection path (line 378–385):**
```typescript
// Extract mood hint from text
const moodHint = /\bfunny|humor|hilarious|laugh\b/i.test(text) ? "funny"
  : /\badventure|epic|wild|thrilling\b/i.test(text) ? "adventure"
  : /\bmemorial|memory|remember|miss\b/i.test(text) ? "memorial"
  : null;
const moodToUse = moodHint || project?.mood || "heartfelt";

// Don't call startInterview() — it wipes the chat. Just set status.
await updateProject.mutateAsync({
  id: activeProjectId!,
  mood: moodToUse,
  pet_name: project?.pet_name && project.pet_name !== "New Project"
    ? project.pet_name
    : pendingPetName || "New Project",
});
await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
// handleFinishInterview with skipNameCheck=true so it doesn't get blocked
handleFinishInterview(true);
```

**Fix 3 — `handleFinishInterview` accepts `skipNameCheck` flag:**
```typescript
const handleFinishInterview = async (skipNameCheck = false) => {
  if (!activeProjectId || isFinishing) return;
  if (!skipNameCheck && (!project?.pet_name || project.pet_name === "New Project")) {
    // ask for name...
    return;
  }
  // ... rest of generation logic
};
```

These three targeted changes fix both bugs without restructuring the flow.
