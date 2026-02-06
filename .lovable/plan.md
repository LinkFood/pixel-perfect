

# Fix Interview Chat: Stop the Infinite Loop + Make It Finishable

## The Problems

1. **164 messages sent to AI every call** -- this is hitting token limits and causing the 500 error. Each call sends the ENTIRE conversation history to GPT-5.2.
2. **The AI never stops asking questions** -- the system prompt suggests wrapping up but doesn't enforce it. You've been answering for ages.
3. **No message windowing** -- even a working interview shouldn't send 164 messages. We need to send a summary + recent messages.
4. **Progress bar misleading** -- shows "X of ~12" but doesn't guide the user to finish.

## The Fixes

### 1. Message windowing in the edge function (`interview-chat`)
- If there are more than 20 messages, summarize the older ones into a single "context" message
- Always send: system prompt + summary of early messages + last 10 messages
- This keeps token usage reasonable no matter how long the conversation goes

### 2. Force wrap-up after enough exchanges
- Add the current exchange count to the system prompt dynamically
- After 10+ user messages: append "You now have plenty of material. In your next response, warmly wrap up and let them know you have everything needed for a beautiful story."
- After 15+ user messages: append "STOP asking questions. Thank them and confirm you're ready to create the book."

### 3. Fix the UI to guide finishing
- After 8+ user messages: show a persistent "Finish Interview" button prominently
- After 12+ user messages: show a banner saying "You've shared wonderful memories! Ready to create Link's book?"
- Change progress bar to cap at 12 and show "Complete!" when reached

### 4. Clear existing bloated conversation
- Add a "Start Fresh" option so you can begin a clean interview for Link without the 164 broken messages
- Or: add logic to only use the last ~20 messages from the existing conversation going forward

## Technical Changes

### File: `supabase/functions/interview-chat/index.ts`
- Accept a `messageCount` parameter from the client
- If messages array has more than 20 items, take the first 5 + last 10, and add a summary instruction
- Dynamically inject wrap-up instructions into the system prompt based on `messageCount`

### File: `src/hooks/useInterview.ts`
- Send only the last 20 messages to the edge function (keep full history in DB for story generation)
- Pass `userMessageCount` to the edge function so it knows when to wrap up

### File: `src/pages/ProjectInterview.tsx`
- After 12+ user messages: show a prominent "You've shared enough! Create your book" banner
- After 15+: auto-show finish button and hide the input field
- Add a "Start Fresh Interview" button that deletes existing messages and restarts

### File: `src/components/project/ChatMessage.tsx`
- No changes needed

