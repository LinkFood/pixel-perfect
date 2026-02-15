

# Fix: Visible Chat Bubbles + Working Mood Flow

## Problem 1: Chat bubbles are invisible

The rabbit's bubble color (`--chat-ai-bg: 35 18% 96%`) is nearly identical to the page background (`40 20% 98.5%`). There's only a 2.5% lightness difference -- the bubble disappears.

**Fix:**
- Darken `--chat-ai-bg` from `35 18% 96%` to `35 20% 92%` (visible warm gray, like iMessage's light gray)
- Darken `--chat-ai-border` from `35 14% 91%` to `35 16% 86%` (subtle but clear edge)
- This creates a ~6.5% lightness contrast which is clearly visible

**File: `src/index.css`** (lines 65-67)

## Problem 2: Mood flow doesn't trigger

When you click "That's all my photos", `handleContinueToInterview` fires and checks `!project?.mood`. If mood is unset, it injects a mood picker message into chat. BUT the rabbit's initial greeting ("I see: a sleepy brown and white puppy...") is set via `getRabbitGreeting()` which renders as a static element ABOVE the chat messages array. The mood picker message gets added to `chatMessages` but may not be visible if the user isn't scrolling down, OR the `chatMoodPending` state isn't persisting correctly across re-renders triggered by the status mutation.

**Fix:**
- After `handleContinueToInterview` sets status to "interview" AND injects the mood picker message, ensure `scrollToBottom()` fires after the state updates settle (use a small delay)
- Add a defensive check: if phase becomes "mood-picker" (derived from `!project.mood`) AND `chatMoodPending` is false AND no mood picker message exists in chat, auto-inject one
- This catches the case where the component re-renders and loses the pending state

**File: `src/pages/PhotoRabbit.tsx`**

## Problem 3: Rabbit greeting is static, not conversational

The `rabbitGreeting` renders as a permanent static message above all chat messages. This means it never goes away and the rabbit appears to say the same thing forever while new messages stack below it. It should be part of the chat flow, not a fixed element.

**Fix:**
- Remove the static `rabbitGreeting` `ChatMessage` from the JSX
- Instead, when the component mounts or photos change, inject the greeting as the FIRST message in `chatMessages` (only if chatMessages is empty)
- This makes the rabbit's words part of the conversation timeline, not a frozen header

**File: `src/pages/PhotoRabbit.tsx`** (lines 650-681 for `getRabbitGreeting`, lines 694-696 for the static render)

---

## Technical Details

### CSS changes (src/index.css)
```css
--chat-ai-bg: 35 20% 92%;      /* was 35 18% 96% */
--chat-ai-text: 240 10% 8%;     /* unchanged */
--chat-ai-border: 35 16% 86%;   /* was 35 14% 91% */
```

### Greeting as chat message (src/pages/PhotoRabbit.tsx)
- Add a `useEffect` that watches `phase` and `photos.length`
- When `chatMessages` is empty and we have a greeting to show, push it as `{ role: "rabbit", content: greeting }` into `chatMessages`
- Remove the static `{rabbitGreeting && <ChatMessage .../>}` from JSX (line 694-696)
- This makes ALL rabbit text appear as proper bubbles in the conversation flow

### Mood picker auto-recovery (src/pages/PhotoRabbit.tsx)
- Add a `useEffect` watching `phase`:
  ```
  if phase === "mood-picker" && !chatMoodPending && no mood picker in chatMessages:
    setChatMoodPending(true)
    inject mood picker message
  ```
- This handles page refreshes and re-renders that might lose the mood picker state

### Summary of files changed
| File | Change |
|------|--------|
| `src/index.css` | Darken chat bubble background + border tokens |
| `src/pages/PhotoRabbit.tsx` | Move greeting into chat flow, add mood picker auto-recovery |

