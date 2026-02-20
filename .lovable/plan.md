
# Comprehensive Bug Fix: Chat Wipe + Progress Bar

## All Bugs Identified

### Bug 1 — Chat History Wiped (Root Cause Found)

The core cause is a race condition in phase derivation combined with `startInterview()` resetting messages.

When the user types "make a funny book of X" in the `upload` phase:

1. The intent path fires, adds user message + "Got it" rabbit message to `chatMessages`
2. `updateProject.mutateAsync({ mood: "funny", ... })` is awaited — DB updates
3. React Query refetches `project` — but for a brief moment `project.mood` is still `null` in the old cache → phase derives as `"mood-picker"`
4. The **mood-picker auto-recovery effect** (line 948) detects `phase === "mood-picker"` and no picker in chat, so it calls `setChatMessages(prev => [...prev, { moodPicker: true, ... }])` — appending a mood picker card
5. Then `updateStatus.mutateAsync({ status: "interview" })` resolves — project refetches with the correct mood and status → phase becomes `"interview"`
6. **Greeting injection effect** fires because `[project, activeProjectId, phase]` changed. It checks `chatMessages.length > 0` — true, returns early. ✓
7. **BUT**: `startInterview()` is never called in the fast-intent path (correctly), so `greetingInjectedRef` still holds the old value. Good.
8. The `handleFinishInterview(true)` fires (after 800ms), which calls `updateStatus.mutateAsync({ status: "generating" })`. Phase shifts to `"generating"`.
9. The DB restore effect (line 517) has condition `if (phase !== "interview" && phase !== "generating") return`. Since phase is now "generating", it evaluates further: `interviewMessages.length === 0` (user used fast-intent, nothing in DB interview table) AND `chatMessages.length > 0` — so it skips. ✓
10. Generation completes → phase becomes `"review"` → DB restore effect returns early (phase not interview/generating). ✓

**So why does chat look wiped?** Because the mood picker card (step 4) appears in the chat. The user sees the "what vibe?" card even though they already specified "funny." That makes it look like the chat context was lost and the system is asking the same question again. It's not truly wiped — it's a spurious mood-picker insertion.

**Also**: `handleQuickGenerate()` on line 702 STILL calls `startInterview("heartfelt")` which DOES a full `setChatMessages([greeting])` reset. This is called from the "⚡ Make it now" button. That IS a genuine wipe.

### Bug 2 — Progress Bar Not Visible

The progress bar (line 973) has condition: `phase === "interview" && userInterviewCount > 0`

`userInterviewCount` is `interviewMessages.filter(m => m.role === "user").length` (line 783).

`interviewMessages` comes from the DB query for `project_interview` table. In the fast-intent path, the user's message is NEVER saved to `project_interview` — it goes directly to generation. So `userInterviewCount` stays 0. The bar never shows.

Even in the normal interview flow: `userInterviewCount` counts DB rows, which only update after the round-trip. The local `chatMessages` grow immediately, but the progress bar uses the slower DB count. So there's lag.

Additionally: the progress bar is conditionally shown only in `interview` phase, but when the fast-intent generates, phase goes `upload → interview → generating` very quickly — the interview phase may be too brief for the bar to matter.

**The fix**: Count user messages from `chatMessages` (local state) instead of from the DB, or use the larger of the two values. This makes it instant and responsive.

### Bug 3 — Spurious Mood-Picker Card

The mood-picker auto-recovery effect (line 948) triggers whenever `phase === "mood-picker"` and there's no picker in chat. This fires during the brief window when `project.mood` is still null in cache after the mutation. The fix: add a flag (or check `chatMoodPending` more carefully) to suppress this when we've just set a mood via the intent path.

### Bug 4 — `handleQuickGenerate` Still Calls `startInterview()` (Genuine Chat Wipe)

Line 715: `startInterview("heartfelt")` — this always does `setChatMessages([greeting])`. If the user clicks "⚡ Make it now" after having an existing chat, their history is gone. Fix: remove the `startInterview()` call from `handleQuickGenerate` and just update status directly (same fix applied elsewhere).

---

## The Fixes

### Fix 1 — Suppress Spurious Mood-Picker (mood-picker auto-recovery)

Add a ref `suppressMoodPickerRef` that gets set to `true` when the intent path sets the mood, suppressing the auto-recovery for that render cycle:

```typescript
const suppressMoodPickerRef = useRef(false);

// In the intent detection path (before updateProject.mutateAsync):
suppressMoodPickerRef.current = true;
await updateProject.mutateAsync({ ... });

// In mood-picker auto-recovery effect:
useEffect(() => {
  if (phase !== "mood-picker") return;
  if (suppressMoodPickerRef.current) { suppressMoodPickerRef.current = false; return; }
  if (chatMoodPending) return;
  ...
}, [phase, chatMoodPending, chatMessages, scrollToBottom]);
```

This prevents the spurious mood-picker card from appearing when the intent path already handled the mood.

### Fix 2 — Remove `startInterview()` from `handleQuickGenerate`

Replace the `startInterview("heartfelt")` call (which wipes chat) with a direct status update:

```typescript
// BEFORE:
startInterview("heartfelt");
setTimeout(() => handleFinishInterview(), 300);

// AFTER:
await updateStatus.mutateAsync({ id: activeProjectId!, status: "interview" });
setTimeout(() => handleFinishInterview(true), 800); // skipNameCheck=true + longer timeout
```

### Fix 3 — Progress Bar: Use Local Chat Count Instead of DB Count

Replace `userInterviewCount` in the progress bar with a locally-computed count from `chatMessages`:

```typescript
const localUserCount = chatMessages.filter(m => m.role === "user").length;
const displayCount = Math.max(userInterviewCount, localUserCount);
```

Use `displayCount` in the progress bar so it updates instantly as the user types/sends, not after the DB round-trip.

Also update the condition to check `localUserCount > 0 || userInterviewCount > 0`.

### Fix 4 — Progress Bar: Also Show on `upload` Phase When Chatting

Currently the progress bar only shows `phase === "interview"`. But when a user is in `upload` phase and chatting, the AI is already engaged. Show the bar when `phase === "interview" || (phase === "upload" && displayCount > 0)`.

Actually — the simpler, cleaner fix is to keep it interview-only, but ensure the phase transition is reliable.

---

## Summary of All Changes in `src/pages/PhotoRabbit.tsx`

| Location | Change |
|---|---|
| Line 783 (userInterviewCount) | Add `localUserCount` from chatMessages and `displayCount = Math.max(...)` |
| Line 702-725 (`handleQuickGenerate`) | Remove `startInterview()` call, use direct status update + `handleFinishInterview(true)` |
| ~Line 362 (intent detection) | Add `suppressMoodPickerRef.current = true` before the mood update |
| Line 948 (mood-picker auto-recovery effect) | Check `suppressMoodPickerRef.current` and bail if true |
| Line 973 (progress bar render) | Use `displayCount` instead of `userInterviewCount`, update condition |

These five targeted changes fix all reported issues:
- Chat history stays intact (no spurious mood picker, no startInterview wipe)
- Progress bar updates immediately from local state
- The "make a book of X" fast-intent path flows cleanly to generation
