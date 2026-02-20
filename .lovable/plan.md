
# Two-Speed Flow — Code Review & Findings

## What I Verified in the Live Code

### 1. Speed Choice Buttons — Implemented Correctly

The code for the two-speed flow IS in place:

- `showSpeedChoice` state starts false
- A `useEffect` watches `chatMessages` and `phase`. Once `phase === "interview"` and the first rabbit message (non-moodPicker) appears, it sets `speedChoiceShownRef.current = true` and `setShowSpeedChoice(true)`.
- The buttons render inline in the chat directly below the first rabbit message (line 927, `i === chatMessages.findIndex(m => m.role === "rabbit" && !m.moodPicker)`).
- "⚡ Make it now" calls `handleQuickGenerate()` → sets `showSpeedChoice(false)`, adds rabbit message, calls `handleFinishInterview()`.
- "💬 Tell me more first" calls `setShowSpeedChoice(false)` and lets the interview continue.
- `allowQuickFinish` is passed to `WorkspaceSandbox` as `showSpeedChoice && userInterviewCount === 0`.

**Structure looks correct in code.**

---

### 2. Critical Bug Found — Buttons Never Appear in Practice

Here is the actual chat from the network logs (your real session for project `57d41cd2`):

```
User:      "make a funny 4 page book"
Rabbit:    "That sleepy brown-and-white puppy with the floppy ears..."
User:      "one shot silly story"
Rabbit:    "I love the idea..."
User:      "nap dream sounds good"
Rabbit:    "I love the nap-dream twist..."
User:      "nope"
Rabbit:    "Perfect — we'll keep it simple..."
User:      "happy"
Rabbit:    "Hearing 'happy' about New Project curled into..."
```

**The problem is clear:** The user sent the FIRST message BEFORE the rabbit spoke. The user typed "make a funny 4 page book" and hit send — they didn't wait for the rabbit's opening greeting to appear.

This breaks the speed-choice trigger because:

```typescript
// This useEffect only shows speed choice after first RABBIT message appears in chat
const firstRabbitMsg = chatMessages.find(m => m.role === "rabbit" && !m.moodPicker);
if (!firstRabbitMsg) return;
speedChoiceShownRef.current = true;
setShowSpeedChoice(true);
```

By the time the rabbit's first message appears, `speedChoiceShownRef.current` is already `true` — WAIT. Actually the ref starts as `false`. But... there's a subtler issue.

**The real culprit:** The `startInterview()` function at line 521 calls `setShowSpeedChoice(false)` and resets `speedChoiceShownRef.current = false`. Then it calls `setChatMessages([{ role: "rabbit", content: greeting }])` — setting the greeting as the first message. This greeting IS a rabbit message without moodPicker. So the useEffect SHOULD fire.

**But looking more carefully at the session:** The interview was entered from a state where the project was named "New Project" — the name prompt was skipped. This means `chatNamePending` and `chatMoodPending` were bypassed, and the project already had a mood set. When the mood picker wasn't shown in chat, there may have been no `moodPicker: true` message in the array for the filter to work against.

**The actual race condition:** When `startInterview()` fires, `chatMessages` is set to exactly one rabbit message. The useEffect watching `[chatMessages, phase]` fires. At that point `speedChoiceShownRef.current` is `false` (just reset). The `firstRabbitMsg` IS found. So `setShowSpeedChoice(true)` IS called.

BUT — the user was already typing. They sent "make a funny 4 page book" BEFORE `showSpeedChoice` became true in the render, OR there's a timing issue where the state update to `showSpeedChoice = true` and the re-render happened but the buttons were attached to message index `i === 0` and by the time the user's message was added as message[1], the render re-evaluated correctly.

**The real issue discovered:** Looking at the index condition on line 927:
```typescript
{showSpeedChoice && phase === "interview" && i === chatMessages.findIndex(m => m.role === "rabbit" && !m.moodPicker) && (
```
Once the user types a message and it's added to `chatMessages`, the rabbit greeting is still at index 0, `i === 0` matches, and `showSpeedChoice` is still true. The buttons SHOULD still show.

**Conclusion after full analysis:** The buttons did likely show briefly, but the project was loaded directly at project `/57d41cd2` with the mood ALREADY set (returning project). In that case, `startInterview()` may not have been called, meaning `speedChoiceShownRef.current` was never reset to `false`. The greeting was injected by `greetingInjectedRef` path instead of `startInterview()`, which means the buttons never appeared because `speedChoiceShownRef.current` remained `true` from a previous visit.

---

### 3. The "New Project" Name Bug is Confirmed Active

From the network logs, every single rabbit message says things like "**New Project**'s floppy ears" and "picturing **New Project**'s..." — the book is literally named "New Project." The user never got a chance to enter the name because:
- `chatNamePending` flow is only triggered via `handleContinueToInterview()`
- The user was dropped into an existing project on page load that already had `status: "interview"` but no name set

---

### 4. "Tell me more first" Path — canFinish After 4 Messages

This part works correctly. The code at line 686-699 is intact:
```typescript
const canFinish = userInterviewCount >= 4;
// ...
useEffect(() => {
  if (canFinish && !prevCanFinish.current && phase === "interview") {
    setChatMessages(prev => [...prev, {
      role: "rabbit",
      content: "I have enough to start — hit \"Make my book\" whenever you're ready...",
    }]);
  }
  prevCanFinish.current = canFinish;
}, [canFinish, phase]);
```
The user in the session HAS 5 user messages. So `canFinish` is `true`. The "Make my book!" button in WorkspaceSandbox should be visible.

---

## Summary of What Needs to be Fixed

### Fix 1 — Speed choice on project reload (existing projects)
When the app loads an existing interview-phase project, `startInterview()` is NOT called, so `speedChoiceShownRef` is never reset. The greeting is injected by `greetingInjectedRef`. The `showSpeedChoice` useEffect fires but `speedChoiceShownRef.current` is initialized to `false` and the effect CAN run — so this SHOULD work. Need to verify by also making the greeting path set the speed choice.

**The actual fix:** Ensure the speed-choice useEffect covers the greeting injection path, not just `startInterview()`. Currently it only triggers once the first rabbit non-moodPicker message exists — this should work for restored sessions too, UNLESS the restored messages from DB (`useEffect` at line 448-457) populate `chatMessages` before `phase === "interview"` registers.

The restore effect:
```typescript
if (phase !== "interview" && phase !== "generating") return;
if (interviewMessages.length === 0 || chatMessages.length > 0) return;
const restored = interviewMessages.map(...);
setChatMessages(restored);
```
When restoring, the restored messages include MANY rabbit messages. The `findIndex` still finds the first one. `showSpeedChoice` would be `true`. BUT `speedChoiceShownRef.current` would be set to `true`, and then the user already has 5+ messages — the buttons showing after 5 exchanges makes no sense.

**Correct fix:** Only show speed choice if it's the FIRST visit to interview phase — i.e., `userInterviewCount === 0`. Don't show if messages are being restored from DB.

### Fix 2 — "New Project" default name
The name capture only happens through `handleContinueToInterview()`. Projects created earlier without going through this flow get stuck with "New Project." Need a fallback that catches this case — e.g., showing the name prompt if `project.pet_name === "New Project"` when entering review or if the user makes a book.

### Fix 3 — Funny mood prompt could be stronger
The `SHARED_RULES` currently has the funny exception as a single sentence in a long list. It should be moved up and made more prominent so the AI actually respects it.

---

## Proposed Fixes (in priority order)

### Priority 1 — Guard speed choice with `userInterviewCount === 0`
Change the `showSpeedChoice` useEffect to only activate when no user messages have been sent yet AND a restored session isn't being loaded:

```typescript
useEffect(() => {
  if (phase !== "interview") return;
  if (speedChoiceShownRef.current) return;
  if (userInterviewCount > 0) return; // Don't show if user already typed something
  const firstRabbitMsg = chatMessages.find(m => m.role === "rabbit" && !m.moodPicker);
  if (!firstRabbitMsg) return;
  speedChoiceShownRef.current = true;
  setShowSpeedChoice(true);
}, [chatMessages, phase, userInterviewCount]);
```

This ensures:
- On a fresh start: buttons appear after first rabbit greeting, before any user input
- On restore: `userInterviewCount > 0` means no buttons
- On return from review: `userInterviewCount > 0` means no buttons

### Priority 2 — Fix "⚡ Make it now" disappearing if user already typed
The button condition `i === chatMessages.findIndex(...)` anchors to the first rabbit message correctly. But if `showSpeedChoice` is set to `true` after the user has already sent messages (race condition), the buttons appear mid-conversation which looks wrong. The `userInterviewCount === 0` guard above fixes this.

### Priority 3 — Name prompt fallback
If `project.pet_name === "New Project"` when the user clicks "Make my book", intercept and ask for the name first before generating:

```typescript
const handleFinishInterview = async () => {
  if (project?.pet_name === "New Project" || !project?.pet_name) {
    // Show inline name prompt in chat
    setChatNamePending(true);
    setChatMessages(prev => [...prev, { role: "rabbit", content: "One quick thing — what's the name for the star of this book?" }]);
    return;
  }
  // ... existing generation logic
};
```

### Priority 4 — Funny mood wrap-up signal
Add a more explicit signal in the system prompt that appears ONLY for funny mood when `userMessageCount >= 3`:

```typescript
if (effectiveMood === "funny" && userMessageCount >= 3) {
  prompt += `\n\nIMPORTANT: You have enough funny material now. Your next response should be your LAST question or a wrap-up. Funny books are punchy — 3-4 great moments is the sweet spot. Don't ask for more after this.`;
}
```

---

## Files to Change

| File | What Changes |
|------|---|
| `src/pages/PhotoRabbit.tsx` | Guard `showSpeedChoice` useEffect with `userInterviewCount === 0`; add name fallback in `handleFinishInterview` |
| `supabase/functions/interview-chat/index.ts` | Strengthen funny mood wrap-up signal at message count >= 3 |

No database changes needed. These are all client-side and edge function prompt changes.
