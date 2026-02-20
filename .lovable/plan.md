
# Three Fixes + Step Progress Tracker

## What's Wrong (from your screenshot)

**Problem 1 — "Baby Jac" got lost, asked for name/mood instead of making the book**
When you typed "make a short funny 8 page book of baby jac and his dog link...", the system detected your intent correctly but failed to extract your subject name from your message. It used "New Project" as the name. Then, when the phase changed to `interview`, the mood-picker prompt fired because `project.mood` was still `null` — the database update hadn't reflected yet. This caused the name + mood loop instead of just making the book.

**Problem 2 — No quick-reply chips after the rabbit's first question**
Chips only appear when `lastFinishedContent` updates (after an AI streams a response). But the rabbit's first question — "Tell me about this — what's the funniest thing about New Project?" — is injected directly by the local `startInterview()` function, never going through the streaming path. So chips never get computed for that first question. After that first exchange the chips do work, but the most critical moment (first question) shows nothing.

**Problem 3 — No way to know what step you're on**
There's no visible indicator of interview progress. A user has no idea if they're 2 messages in or 8 messages in, or how many are "enough."

---

## Fix 1 — Smarter Intent Extraction (name + mood from user's message)

When the user types something like "make a funny book of baby jac and link", we need to:

1. Extract the mood word from text ("funny" → "funny" ✓ already working)
2. Extract a subject name from the text — grab the key noun phrase after "of", "about", "for", "starring", etc.
3. Use `skipNameCheck = true` so generation doesn't get blocked
4. Wait for the project update to settle before calling `handleFinishInterview`

**Name extraction regex** (added to the intent detection block):
```typescript
// Try to extract subject name from phrases like "book of baby jac", "about link", "for my dog max"
const nameMatch = text.match(
  /\b(?:of|about|for|starring|featuring|with)\s+([a-z][a-z\s]{1,20}?)(?:\s+(?:and|going|playing|at|in|the|\.|,)|$)/i
);
const extractedName = nameMatch?.[1]?.trim() || null;
```

Use `extractedName` as `pet_name` if it's found AND different from "New Project".

Also change the `setTimeout(handleFinishInterview, 300)` to use `setTimeout(handleFinishInterview, 800)` to give the DB update time to propagate before the phase re-derives.

---

## Fix 2 — Chips on the First Rabbit Question

In `startInterview()` (line 571), after calling `setChatMessages([{ role: "rabbit", content: greeting }])`, immediately also compute and set quick replies from that greeting:

```typescript
// In startInterview(), after setChatMessages([{ role: "rabbit", content: greeting }]):
const initialReplies = getQuickReplies(greeting, project?.pet_name || "them", mood);
setQuickReplies(initialReplies);
```

This means the very first rabbit question will show chips immediately — no wait for streaming.

Also update the chips rendering condition from `phase === "interview"` to also show during `mood-picker` and right after transitioning:
```
(phase === "interview" || phase === "upload") && quickReplies.length > 0 && !isStreaming && input.length === 0
```
Actually keeping it to `interview` only is correct — but we must ensure the phase IS interview when these chips render. The `startInterview()` call sets the DB status to interview, so that's fine.

---

## Fix 3 — Interview Step Progress Indicator

A small, lightweight progress strip pinned at the top of the chat scroll area during the interview. Shows how many messages deep you are and a soft "enough to make a book" milestone.

**Design**: A thin horizontal bar with dots or a simple text label. Unobtrusive — sits at the top of the chat area, not blocking anything.

```
● ● ● ○ ○ ○ ○ ○   3 of 8 — keep going!
                                              [Make my book ✓] ← appears when canFinish
```

Or even simpler — a thin pill:

```
Step 3 · Share more for a richer story   →   Step 5 · Almost there!   →   Step 7 · Ready to make your book ✓
```

**What it shows:**
- Messages 1–3: "Getting started · share more for a richer book"
- Messages 4–5: "Going great · the rabbit is hooked"  
- Messages 6–7: "Almost there · ready to make your book"
- Messages 8+: "You're done · hit Make My Book whenever"

**Where it renders:** Between the rabbit avatar and the chat scroll content, only when `phase === "interview"` and at least 1 user message has been sent. Stays pinned, doesn't scroll with messages.

---

## Technical Details

### Files Changed

| File | Change |
|------|--------|
| `src/pages/PhotoRabbit.tsx` | Fix 1: better name extraction + longer timeout in intent detection. Fix 2: call `getQuickReplies` inside `startInterview()` to set chips on first greeting. Fix 3: render a step-progress strip in the chat panel during interview. |

### Step Progress Component (inline in PhotoRabbit.tsx)

```typescript
// Inside the chat panel, above the scroll area, only in interview phase:
{phase === "interview" && userInterviewCount > 0 && (
  <div className="shrink-0 px-4 py-1.5 flex items-center gap-2">
    <div className="flex gap-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
            i < userInterviewCount ? "bg-primary" : "bg-border"
          }`}
        />
      ))}
    </div>
    <span className="text-[11px] text-muted-foreground font-body">
      {userInterviewCount < 4
        ? "Share more for a richer story"
        : userInterviewCount < 7
        ? "Going great — rabbit is hooked"
        : "Ready · hit Make My Book anytime"}
    </span>
  </div>
)}
```

This gives the user a clear, friendly sense of where they are without feeling clinical or overwhelming.

### Name Extraction (in `handleSend`, intent detection block)

Add this before the `updateProject.mutateAsync` call:
```typescript
// Extract subject name from "make a book of X" / "about X" / "for X"
const nameMatch = text.match(
  /\b(?:of|about|for|starring|featuring)\s+([a-zA-Z][a-zA-Z\s]{1,25}?)(?:\s+(?:and\b|going|playing|at\b|in\b|the\b)|[,.]|$)/i
);
const extractedName = nameMatch?.[1]?.trim();
const nameToUse = extractedName && extractedName.toLowerCase() !== "new project"
  ? extractedName
  : (project?.pet_name && project.pet_name !== "New Project")
    ? project.pet_name
    : pendingPetName || null;
```

Then pass `nameToUse` as `pet_name` in the `updateProject.mutateAsync` call. If `nameToUse` is null/empty, still pass "New Project" but increase the settle timeout.

### Quick Replies on First Greeting

In `startInterview()`, after line 602 (`setChatMessages([{ role: "rabbit", content: greeting }])`), add:
```typescript
const initialReplies = getQuickReplies(greeting, project?.pet_name || "them", mood);
setQuickReplies(initialReplies);
```

This is the only change needed for Fix 2 — one line.

---

## Summary of Changes

1. **Name extraction** from the user's "make me a book of X" message — saves typing the name separately
2. **First-question chips** — quick replies now appear immediately on the rabbit's first greeting, not just after AI streams
3. **Step dots** — 8 small dots + a contextual label pinned at the top of the chat, only during interview, showing progress clearly without being overwhelming
