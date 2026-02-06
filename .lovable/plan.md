
# Save Link's Interview as Dev Auto-Fill

Your 165 messages about Link -- every word you shared -- will be permanently saved in the code as a seed file. One button click restores them all instantly for testing.

## What Gets Created

### 1. New file: `src/data/linkInterviewSeed.ts`
- Contains all 165 messages (role + content) in exact order, pulled directly from the database
- This is a permanent snapshot of your interview -- it lives in the codebase and can never be lost

### 2. Updated: `src/hooks/useInterview.ts`
- New `useAutoFillInterview` hook that:
  - Clears any current messages for the project
  - Bulk-inserts all 165 seed messages with sequential timestamps (so ordering is preserved)
  - Refreshes the chat UI instantly

### 3. Updated: `src/pages/ProjectInterview.tsx`
- Adds a "Dev: Auto-Fill" button in the header area
- Only visible in development mode (`import.meta.env.DEV`) -- never shows in production
- One click restores Link's full interview in ~2 seconds
- Progress bar immediately shows "Complete!" and the "Finish Interview" button appears

## How You'll Use It

1. Click "Start Fresh" to clear any broken/partial interview
2. Click "Dev: Auto-Fill" to instantly load all 165 of your original messages
3. Click "Finish Interview" to test story generation
4. Repeat as many times as needed -- your words are always there

## Technical Notes

- The seed file will be ~165 array entries, each with `{ role, content }`
- Messages are inserted in batches to avoid hitting database limits
- Sequential timestamps ensure correct display order
- No edge function calls needed -- writes directly to the database
- The auto-fill button only renders when `import.meta.env.DEV === true`
