
# Root Cause Analysis: Chat Wipe + Missing Progress Bar

## What the screenshots show

**Screenshot 1 (upload phase, healthy):** Rabbit says "I see: A large, dark brown dog wearing a festive bandana sits..." — caption message, chat is intact. User is about to type the intent message.

**Screenshot 2 (after typing the intent message):** Chat is completely wiped. Only TWO rabbit messages remain:
- "Tell me about this moment — what makes it special?" ← this is `shortGreetings.heartfelt`
- "One quick thing — what's the name for the star of this book?" ← this is from `handleFinishInterview(false)`

This is the signature of `startInterview("heartfelt")` being called (reset to `[greeting]`) followed by `handleFinishInterview(false)` (with `skipNameCheck=false`, which asks for the name). No progress bar. No chips.

---

## The Three Root Causes

### Root Cause 1 — "That's all my photos" button races the intent path

When the user types the intent message:
1. Intent path fires, adds messages to chat, calls `updateProject({ mood: "funny" })` and `updateStatus({ status: "interview" })`
2. `setTimeout(() => handleFinishInterview(true), 800)` is queued

**Meanwhile**, React Query refetches and `project.mood` becomes `"funny"`. The "That's all my photos — let's go!" button is still visible (it lives in the sandbox panel). If the user clicks it at any point after the mood refetches, `handleContinueToInterview()` runs:
- `project?.mood` is now `"funny"` → takes the `else` path at line 568
- Calls `startInterview("funny")` → **`setChatMessages([greeting])` — full wipe**

This is the most likely cause of Screenshot 2. The user may have clicked the button out of habit after typing, or the button fired from a stale event.

Even if the user did NOT click the button: When `handleFinishInterview(true)` fires at 800ms, if `project?.pet_name` is still "New Project" in the cached data... wait, `skipNameCheck=true` bypasses that. But there's another path: if `fetchBalance()` returns 0 or fails, `setShowCreditGate(true)` fires and adds a message. That's a separate issue.

### Root Cause 2 — The intent path `else` branch skips the status update

When `project?.mood` is ALREADY set (i.e., the user already chose a mood before, or the project already has one) AND the user types the intent message:
- Line 410-415: the `else` branch skips the `updateStatus({ status: "interview" })` call entirely
- `handleFinishInterview(true)` is called immediately (synchronously)
- But if `project?.status` is still "upload" at this point, the status never becomes "interview"
- `handleFinishInterview` → `updateStatus({ status: "generating" })` → works, but the 800ms wait is skipped

This is less likely for this specific bug but could cause issues in other flows.

### Root Cause 3 — Progress bar and chips are gated on `phase === "interview"` only

The progress bar condition: `phase === "interview" && displayCount > 0`

The problem: after the intent path, the phase goes `upload → interview → generating` in quick succession (800ms). The progress bar only shows during `interview`. Since `displayCount = Math.max(userInterviewCount, localUserCount)`, and `localUserCount` counts from `chatMessages` — if `chatMessages` gets wiped (Root Cause 1), `localUserCount` drops to 0, and `userInterviewCount` (from DB) is also 0 because the intent path never writes to `project_interview`.

The quick-reply chips condition: `phase === "interview" && quickReplies.length > 0 && !isStreaming && input.length === 0`. Chips ARE computed and set in `startInterview()` — but if the intent path fires, it never calls `startInterview()`, so `quickReplies` stays empty from when they were cleared on line 345 (`setQuickReplies([])`).

---

## The Fixes

### Fix 1 — Disable the "That's all my photos" button while the intent path is in flight

The most direct fix: when the intent path is running (we already have `isFinishing` for `handleFinishInterview`), also disable the "That's all my photos" button in the sandbox. Better yet: **hide the "That's all my photos" button entirely once phase transitions to interview**, which already happens naturally.

The real fix: in `handleContinueToInterview`, add a guard against interfering with the intent path by checking if `isFinishing` is true OR if the project status is already "interview" or beyond:

```typescript
const handleContinueToInterview = () => {
  if (!activeProjectId) return;
  if (updateStatus.isPending) return;
  if (isFinishing) return;  // ← ADD THIS: don't interfere with active generation flow
  ...
```

This prevents the button from double-firing during the 800ms window.

### Fix 2 — Prevent `startInterview()` from wiping chat if history already exists

Change `startInterview()` to be non-destructive: instead of `setChatMessages([greeting])`, check if there are already messages and only insert the greeting if the chat is empty:

```typescript
const startInterview = (mood: string) => {
  ...
  // Only inject the greeting if chat is empty — never wipe existing history
  setChatMessages(prev => {
    if (prev.length > 0) return prev;  // ← chat already has context, preserve it
    return [{ role: "rabbit", content: greeting }];
  });
  ...
```

This is the safest change — even if `startInterview` is called unexpectedly, it won't wipe an existing conversation.

### Fix 3 — Set quick replies after the intent path response

In the intent path (inside `handleSend`), after adding the "Got it — making it now! ⚡" rabbit message, also compute and set quick replies so chips appear in the interview phase:

```typescript
setChatMessages(prev => [...prev, { role: "rabbit", content: "Got it — making it now! ⚡" }]);
// Since we're going straight to generation, no chips needed here
// BUT ensure chips are cleared and won't appear after the phase jump
setQuickReplies([]);
```

Actually for the intent path (fast generation), no chips are needed. The issue is that chips DO need to appear in the NORMAL interview flow (when user types something non-intent in upload phase and gets a rabbit reply). The chips already work via `lastFinishedContent` effect — the problem is only that the FIRST greeting has no chips if `startInterview()` isn't called.

Fix: Keep the `startInterview` call to set initial chips for the normal flow, but make it non-destructive (Fix 2 covers this).

### Fix 4 — Show progress bar during upload phase too (when chat is active)

Change the progress bar condition to show whenever the user has sent messages, regardless of phase:

```typescript
{(phase === "interview" || phase === "upload") && displayCount > 0 && (
```

This way, as soon as the user types anything (even in upload phase), the dots appear.

---

## Summary of All Changes in `src/pages/PhotoRabbit.tsx`

| What | Where | Change |
|---|---|---|
| Guard `handleContinueToInterview` | Line 548 | Add `if (isFinishing) return;` to prevent racing with active generation |
| Make `startInterview` non-destructive | Line 620 | Change `setChatMessages([greeting])` to check `prev.length > 0` first |
| Show progress bar in upload phase too | Line 984 | Change condition to `(phase === "interview" || phase === "upload") && displayCount > 0` |

These three targeted changes are all in `src/pages/PhotoRabbit.tsx`. No other files need touching.

The `startInterview` fix (Fix 2) is the most important — it makes the entire system resilient to multiple callers by ensuring the greeting is only injected once into an empty chat. Even if `startInterview` is called multiple times, or called unexpectedly from the button path, the history is preserved.
