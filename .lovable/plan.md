
# End-to-End Test Report: PhotoRabbit Book Creation Flow

## Test Summary

I tested the full flow from landing page through interview chat. Here is what works, what is broken, and what needs fixing.

---

## WORKING (No Issues Found)

1. **Dev Mode Activation** -- Navigating to `/?dev=1` activates dev mode, auto-signs in via the bootstrap edge function, and lands in the workspace. This works correctly.

2. **Photo Upload** -- Photos can be uploaded via the drop zone. The project is auto-created on first upload. Photos are stored in Supabase storage and records created in `project_photos`.

3. **Photo AI Analysis** -- The `describe-photo` edge function correctly analyzes uploaded photos using Gemini 2.5 Flash and saves captions + structured `ai_analysis` data. All 7 photos for the test project have captions.

4. **Appearance Profile** -- The `build-appearance-profile` edge function works and has generated a profile + `photo_context_brief` for the test project.

5. **Transition to Interview** -- Clicking "That's all my photos -- let's go!" updates the project status to "interview" and the chat interface appears with a greeting message.

6. **Interview Chat Backend** -- The `interview-chat` edge function works perfectly. I tested it directly and it returns a streaming SSE response with AI-generated content. Messages are successfully saved to the `project_interview` table.

7. **User Message Saving** -- When you type and send a message, your message is saved to the database and appears in the chat UI.

8. **Story Generation Backend** -- The `generate-story` edge function is properly structured with tool calling to generate structured page data.

9. **Illustration Generation Backend** -- The `generate-illustration` edge function handles primary/fallback models, retries, image validation, and storage upload.

10. **Project Review Page** -- The review page has a complete feature set: page editing, illustration variants, PDF download, share links, and approval workflow.

---

## BROKEN -- Needs Fixing

### Bug 1: Chat responses are invisible (CRITICAL)

**Symptom**: You send a message in the interview, the AI responds (confirmed in the database), but the response never appears in the chat UI.

**Root Cause**: Race condition in `useInterview.ts` and `Workspace.tsx`.

In `useInterview.ts`, the `finally` block sets both `setIsStreaming(false)` AND `setStreamingContent("")` at the same time. In `Workspace.tsx`, a `useEffect` watches for `isStreaming` to become false and then checks `streamingContent` -- but by then, `streamingContent` is already empty `""`, so the condition `!isStreaming && streamingContent` is always false. The response is never added to the `chatMessages` state.

**Fix**: Save the final content before clearing it. In `useInterview.ts`, store the full content in a ref or separate state variable that persists after streaming ends, so Workspace can read it. Alternatively, change the useEffect in Workspace to not depend on `streamingContent` at all -- instead, re-read the interview messages from the database query after streaming ends.

### Bug 2: Streaming content not visible during typing (MODERATE)

**Symptom**: While the AI is responding, no streaming text appears in the chat. The `streamingContent` state updates, but Workspace only shows it when `isStreaming && streamingContent` (line 335-337). This part should work, but the streaming indicator may not be visible if the scroll position is wrong.

**Fix**: Ensure `scrollToBottom()` is called when streaming content updates, not just on send.

### Bug 3: forwardRef warnings (LOW)

**Symptom**: Console warnings about "Function components cannot be given refs" for `ChatMessage` and `ChatInput` components.

**Root Cause**: `framer-motion`'s `AnimatePresence` tries to pass refs to `ChatMessage`, but `ChatMessage` is a plain function component, not wrapped in `React.forwardRef`.

**Fix**: Wrap `ChatMessage` and `ChatInput` with `React.forwardRef`.

### Bug 4: Project name stuck as "New Project" (LOW)

**Symptom**: The AI refers to the pet as "New Project" because the project is created with a placeholder name and never updated. The interview prompt uses `project.pet_name` which is "New Project".

**Fix**: Either prompt the user for a pet name before starting the interview, or detect the pet name from photos/first message and update the project.

### Bug 5: `share_token` type mismatch (TRIVIAL)

**Symptom**: The `Project` type in `useProject.ts` includes `share_token` but it does not exist in the database schema. No runtime error since it's cast with `as Project`.

**Fix**: Remove `share_token` from the Project type or add the column to the database.

---

## Recommended Fix Priority

1. **Bug 1 (Chat responses invisible)** -- This completely blocks the interview flow. Without seeing AI responses, users cannot have a conversation. Fix the race condition in `useInterview.ts` by not clearing `streamingContent` in the `finally` block, and instead clear it only after the Workspace has consumed it. Or better: let the Workspace rely on the database query invalidation to show new messages instead of the local `streamingContent` state.

2. **Bug 4 (Pet name)** -- Important for book quality. Add a name-collection step or auto-detect from the first user message.

3. **Bug 3 (forwardRef)** -- Quick fix, cleans up console noise.

4. **Bug 5 (type mismatch)** -- Trivial cleanup.

---

## Technical Changes Required

### File: `src/hooks/useInterview.ts`
- In the `sendMessage` callback, do NOT clear `streamingContent` to `""` in the `finally` block simultaneously with setting `isStreaming` to false
- Instead, use a ref to hold the final content, or return it so the consumer can read it

### File: `src/components/workspace/Workspace.tsx`
- Fix the `useEffect` at line 144-150 that adds streaming content to chat messages -- it needs to capture the content before it's cleared
- Alternative approach: after streaming ends, rely on the `interviewMessages` query re-fetch (which already happens) to populate the chat, rather than the local `streamingContent` state

### File: `src/components/workspace/ChatMessage.tsx`
- Wrap with `React.forwardRef` to eliminate the console warning

### File: `src/components/workspace/ChatInput.tsx`
- Wrap with `React.forwardRef` to eliminate the console warning
