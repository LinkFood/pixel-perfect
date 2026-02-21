

# Fix Build Errors + Bug Audit

## Build Errors (2 errors, straightforward fix)

During the overhaul, `chatNamePending` and `chatMoodPending` were converted from `useState` hooks to plain constants (`false`) on lines 126-127. But two places still call the old setter functions that no longer exist:

1. **Line 620**: `setChatNamePending(true)` -- inside `handleFinishInterview` when the project has no name
2. **Line 1035**: `setChatMoodPending(false)` -- inside the mood picker button click handler in the JSX

### Fix

- **Line 620**: Remove `setChatNamePending(true);` -- since `chatNamePending` is always `false`, the name-pending flow is disabled. The code block around it (lines 619-627) asks for a name but will never display the inline name input since the flag is dead. We should keep the chat message prompt but remove the setter call.

- **Line 1035**: Remove `setChatMoodPending(false);` -- the mood picker buttons in JSX (line 1019) are gated by `chatMoodPending` which is always `false`, so this code path is already unreachable. But removing the setter call fixes the build.

## Additional Bug Found: Dead Mood Picker UI

On line 1019, the mood picker buttons render only when `msg.moodPicker && chatMoodPending` is true. Since `chatMoodPending` is hardcoded to `false`, this entire branch is dead code -- it will never render. This is harmless (mood is now auto-set to "heartfelt" on line 941), but worth noting.

## Additional Bug Found: Dead Name Prompt Logic

On line 619, `handleFinishInterview` checks if the project has no name and tries to prompt the user. But since `setChatNamePending` doesn't exist, this crashes the build before it even runs. After removing the setter, the code will:
- Add the "what's the name?" message to chat
- Return early (line 626)
- But `chatNamePending` is always `false`, so the user's next typed response won't be caught as a name answer

This means the name prompt fires but the response isn't handled. The fix: since the overhaul removed the name-pending flow intentionally (replaced by organic discovery + auto-extraction from photos on line 542-548), we should remove the entire name-check block (lines 619-627) or replace `setChatNamePending(true)` with just letting the chat message appear without the early return, so the flow continues to generation with a fallback name.

**Recommended approach**: Keep the name prompt message but don't block generation. If the name is still "New Project", use a sensible fallback derived from photo analysis or default to "Your Story".

## Summary of Changes

### File: `src/pages/PhotoRabbit.tsx`

1. **Line 620**: Remove `setChatNamePending(true);` and rework the name-check block so it doesn't block generation -- instead, auto-set a fallback name from photo analysis or "Your Story" and continue.

2. **Line 1035**: Remove `setChatMoodPending(false);` -- just delete that one line. The surrounding code is dead but harmless.

