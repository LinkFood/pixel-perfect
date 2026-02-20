
# Quick Book vs. Deep Interview — Two-Speed Flow

## The Problem (What You Experienced)

You uploaded photos, the AI analyzed them and built a real appearance profile — it genuinely knows what's in the pictures. But then the interview forces you through 4+ back-and-forth exchanges before "Make my book" even appears. For someone who just wants something fast and fun, that's friction.

The current minimum is hard-coded: `canFinish = userInterviewCount >= 4`. You can't make a book until you've sent 4 messages. The rabbit also never offers to wrap up early on its own.

The good news: the AI already has everything it needs from the photos alone. The interview adds richness, but it's not required for the engine to produce a real book. The `generate-story` function works just as well with zero interview messages — it falls back gracefully to the photo captions and appearance profile.

---

## The Solution: Two In-Chat Action Buttons

After the rabbit sends its **first message** in the interview (the opening observation about the photos), show two subtle action buttons directly below it in the chat:

```
[ ⚡ Make it now — let AI decide ] [ 💬 Go deeper ]
```

- **"Make it now"** — skips the rest of the interview, triggers book generation immediately using just the photos the AI already analyzed. The rabbit says something like "I've studied your photos — I've got this. Watch me go!" and generation starts.
- **"Go deeper"** — dismisses the buttons and continues the normal interview flow. The user keeps chatting. "Make my book" appears after 4 messages as usual.

Once one button is clicked, both disappear and never come back.

---

## Technical Changes Required

### 1. `src/pages/PhotoRabbit.tsx` — Add quick-generate state + handler

Add two new state values:
- `showSpeedChoice` (boolean) — whether to show the two buttons
- Once "Make it now" is clicked, call `handleFinishInterview()` directly (it already handles credits, status update, and generation trigger — no new logic needed)
- Once "Go deeper" is clicked, set `showSpeedChoice = false` and let the interview continue normally

Set `showSpeedChoice = true` after the rabbit sends its first interview message (i.e., when `interviewMessages.length === 1` and the first message is from assistant).

Also: for the "Make it now" path, lower the `canFinish` threshold to 0 temporarily by calling `handleFinishInterview()` directly, bypassing the `userInterviewCount >= 4` guard.

### 2. `src/pages/PhotoRabbit.tsx` — Render the two buttons in chat

In the chat message render loop, after the first rabbit interview message, inject the two-button choice block. This is rendered inline in the chat (not in the sidebar) using the same pill-button style as the mood picker.

The buttons look like:
```tsx
<div className="flex gap-2 flex-wrap">
  <button onClick={handleQuickGenerate}>⚡ Make it now</button>
  <button onClick={() => setShowSpeedChoice(false)}>💬 Tell me more first</button>
</div>
```

### 3. `supabase/functions/interview-chat/index.ts` — Shorten the "funny" mood minimum

Currently the AI prompt says "Do NOT wrap up too early. You need real scenes with sensory details, not just facts." For the funny mood in particular, this means the rabbit keeps asking questions even when it has enough.

Add a `mood`-aware adjustment: when mood is `funny`, the minimum good-enough threshold is lower (2-3 exchanges, not 4-8), because humor books need less emotional depth.

Add a line to the system prompt for funny mode:
```
For a funny book, 2-3 good anecdotes is genuinely enough. Don't drag it out looking for more depth — funny books are PUNCHY.
```

### 4. `src/components/workspace/WorkspaceSandbox.tsx` — Lower the minimum for quick path

Add a new prop `allowQuickFinish?: boolean` to `WorkspaceSandbox`. When true, show the "Make my book" button even if `userInterviewCount < 4`. This allows the "Make it now" path to bypass the count gate cleanly.

---

## User Flow After the Change

```
User uploads 3 photos
  -> Rabbit: "That golden light in photo 2 — was that outdoors? 
              I can already see the story here. You can jump straight in
              or tell me more first."
  
  [ ⚡ Make it now ]   [ 💬 Tell me more first ]

Option A — clicks "Make it now":
  -> Rabbit: "I've studied every photo. Let me paint this. Watch!"
  -> Generation starts immediately (0 interview messages, photos only)
  -> Book is made from AI's photo analysis alone

Option B — clicks "Tell me more first":
  -> Buttons disappear, normal interview continues
  -> 4 messages later: "Make my book!" button appears
  -> Richer story from combined photos + interview
```

---

## Files to Change

| File | What Changes |
|------|------|
| `src/pages/PhotoRabbit.tsx` | Add `showSpeedChoice` state; inject two-button block after first rabbit message; wire "Make it now" to bypass the 4-message gate |
| `src/components/workspace/WorkspaceSandbox.tsx` | Accept `allowQuickFinish` prop; show Make My Book button even at 0 messages when flag is set |
| `supabase/functions/interview-chat/index.ts` | Add funny-mode note that 2-3 exchanges is enough — don't drag it out |

No database changes needed. No new edge functions. The quick path reuses 100% of the existing generation pipeline.
