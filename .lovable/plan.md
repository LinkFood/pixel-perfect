
# Quick-Reply Suggestion Chips for the Rabbit Interview

## What This Does

Every time the rabbit finishes responding with a question, 2–4 tappable answer chips appear directly below the rabbit's message in the chat. Tapping one instantly fills in the answer and sends it — no typing needed. The chips disappear the moment the user either taps one or starts typing their own answer.

This matches the pattern already in the codebase for mood selection (the mood picker chips that appear under the rabbit's vibe-choice message). We're extending that same pattern to work for every rabbit interview question.

---

## How the Suggestions Are Generated

The rabbit's questions come from the AI via streaming. After each stream completes, the `lastFinishedContent` state in `useInterviewChat` holds the full text.

We add a lightweight client-side function — `extractQuickReplies(rabbitMessage, petName, mood)` — that parses the rabbit's message and generates contextually appropriate reply chips. This runs entirely on the client, no extra API call.

The function works by:
1. Detecting the question type from keywords in the message ("funniest", "first memory", "miss", "look like", "personality", etc.)
2. Returning 3–4 short, conversational answers that fit that question type
3. Always including a "✍️ Tell my own story" fallback chip

Example:
- Rabbit asks: *"What's the funniest thing about them?"*
- Chips: `"Total chaos agent 😂"` · `"Always begging for food"` · `"Has a signature look"` · `"✍️ Tell my own story"`

- Rabbit asks: *"What's one memory you want to keep forever?"*
- Chips: `"The first day we met"` · `"A quiet morning together"` · `"A trip we took"` · `"✍️ Tell my own story"`

The chips are prompts, not final answers — they give the user a starting point. When tapped, the text fills into the chat input where the user can edit it before sending, OR it sends immediately (we'll implement it as instant-send for speed, matching the mood picker UX).

---

## Architecture

### New utility function: `src/lib/quickReplies.ts`

A pure function `getQuickReplies(content: string, petName: string, mood: string | null | undefined): string[]` that:
- Takes the rabbit's latest message text
- Returns 3–4 short reply strings
- Uses keyword matching against common interview question patterns
- Returns an empty array `[]` for non-question messages (wrap-up messages, affirmations, etc.)

Detection patterns:
```
"funny" / "ridiculous" / "hilarious" → ["Total chaos agent 😂", "Always begging for attention", "The look they give me", "✍️ Tell my own story"]
"miss" / "memorial" / "remember" → ["Their silly little habits", "The way they'd greet me", "Quiet moments together", "✍️ Tell my own story"]
"first" / "meet" / "find you" → ["Pure accident", "Love at first sight", "They found me actually", "✍️ Tell my own story"]
"adventure" / "explore" / "bravest" → ["Into everything, fearless", "That one epic escape", "Every walk is a mission", "✍️ Tell my own story"]
"personality" / "like" / "character" → ["Total drama queen", "The most gentle soul", "One-of-a-kind energy", "✍️ Tell my own story"]
"morning" / "routine" / "day" → ["Alarm clock, basically", "Chaos from the jump", "Pure chill until food time", "✍️ Tell my own story"]
"photo" / "shot" / "picture" / "capture" → ["Sunset on the back porch", "Their favourite nap spot", "Mid-zoomies action shot", "✍️ Tell my own story"]
"memory" / "moment" / "bottl" → ["The first day we met", "A quiet morning together", "A trip we took", "✍️ Tell my own story"]
"special" / "unique" / "nobody" → ["The way they look at me", "Their weird little rituals", "Somehow always knows", "✍️ Tell my own story"]
```

If no keyword matches (e.g. the rabbit is wrapping up with "I have everything I need..."), return `[]` — no chips shown.

### State in `PhotoRabbit.tsx`

Add a single new state:
```typescript
const [quickReplies, setQuickReplies] = useState<string[]>([]);
```

In the `useEffect` that handles `lastFinishedContent` (line ~452), after pushing the rabbit message to `chatMessages`, also compute and set the quick replies:
```typescript
const replies = getQuickReplies(lastFinishedContent, project?.pet_name || "them", project?.mood);
setQuickReplies(replies);
```

Clear quick replies when:
- User sends any message (`handleSend`)
- User starts typing (on `input` change, if `input.length > 0`, clear chips)
- User is streaming (when `isStreaming` becomes true)
- Phase changes away from interview

### Rendering in `PhotoRabbit.tsx` chat panel

The quick reply chips render between the last rabbit message and the `ChatInput`. They appear just above the input area, below the chat scroll — similar to how the mood picker chips appear but as a floating row above the input, not inside the chat bubbles.

Two placement options:
- **Option A** (inside scroll area, below last message): chips appear as part of the chat flow
- **Option B** (above input bar, pinned): chips are always visible without scrolling

We'll use **Option B** — chips pinned above the input bar. This is the iMessage / WhatsApp pattern. The chips are always in reach without scrolling.

The chips strip sits between `scrollRef` (the chat area) and the `ChatInput` component:
```
┌─────────────────────────────────────┐
│         chat scroll area            │
│  ...                                │
│  🐰 "What's the funniest thing      │
│       about them?"                  │
│─────────────────────────────────────│
│  [Total chaos 😂] [Begging for food]│  ← Quick reply chips (pinned)
│  [Signature look] [✍️ Own story]    │
│─────────────────────────────────────│
│  [📎] Type a message...      [🐾]   │  ← ChatInput
└─────────────────────────────────────┘
```

Chips animate in with a subtle `y: 8 → 0` slide-up when they appear, and fade out when cleared.

When a chip is tapped:
1. The chip text populates `input`
2. `handleSend()` fires immediately (same as mood picker chips — no extra confirmation step needed, the user chose it deliberately)
3. `quickReplies` is cleared

The "✍️ Tell my own story" chip populates the input but does NOT auto-send — it focuses the text input so the user can type their actual story.

---

## Files to Change

| File | What Changes |
|------|-------------|
| `src/lib/quickReplies.ts` | New file — pure function that maps rabbit message text to reply chip options |
| `src/pages/PhotoRabbit.tsx` | Add `quickReplies` state; set it in the `lastFinishedContent` effect; clear it on send/type; render the chips strip above `ChatInput` |

No changes needed to `ChatMessage.tsx`, `ChatInput.tsx`, `useInterviewChat.ts`, or any edge functions.

---

## What the Chips Look Like

Matching the existing mood picker chip style already in the codebase:
```
bg-primary/10 text-primary border border-primary/20
hover:bg-primary hover:text-primary-foreground
rounded-full px-4 py-2 text-sm font-body font-medium shadow-sm
transition-colors
```

This is identical to the mood picker buttons — consistency is already designed in.

The chip row wraps on mobile so it never overflows. On desktop it's a single horizontal row. Max 4 chips at a time.

---

## Edge Cases

- **Wrap-up messages** ("I have everything I need..."): `getQuickReplies` returns `[]` — no chips, nothing shown
- **Streaming in progress**: chips hidden while rabbit is mid-response, appear when stream completes
- **User starts typing**: chips fade out (controlled by `input.length > 0` check in the render)
- **Phase is not interview**: chips only render when `phase === "interview"` — no accidental chips during generation or review
- **"Tell my own story" chip**: fills `input` without sending — user types their actual story, hits send themselves
