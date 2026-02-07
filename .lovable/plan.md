
# Fix: Story Generation Failing Silently (0 Pages)

## What's Happening

The `generate-story` edge function is being called successfully and logs "Generating story for Link, 165 interview messages, 162 captioned photos" — but **0 pages** end up in the database. The screen shows "Creating Your Book" but nothing is actually happening.

Two issues are causing this:

1. **The `generate-story` function still references `pet_appearance_profile`** — a column that was removed from the database. While `select("*")` won't crash (it just returns what exists), the code references `project.pet_appearance_profile` in the prompt and logging. This is harmless but messy.

2. **The real problem: the AI call is likely timing out or failing silently.** With 165 interview messages and 162 photo captions, the prompt sent to GPT-5.2 is enormous. The edge function has a default timeout, and the AI gateway may be taking too long to respond. The function catches the error but the client-side code doesn't show it — it just stays on "Writing story..." forever with 0 pages.

## Fix Plan

### 1. Clean up `generate-story/index.ts` references to removed column
- Remove all references to `project.pet_appearance_profile` 
- Pass `null` to `buildSystemPrompt` for the appearance profile parameter
- Remove the appearance block from the user prompt

### 2. Add better error handling and visibility
- Make sure the client-side code in `ProjectGenerating.tsx` properly handles the case where `generate-story` returns an error
- Currently it does `toast.error("Story generation failed")` but the screen stays on "Writing story..." — it should switch to the `failed` phase so the user can retry

### 3. Add a retry button for story generation (not just illustrations)
- Currently the "Retry" button only works for illustrations
- Add a "Retry Story" option when story generation fails

## Files to Change

- `supabase/functions/generate-story/index.ts` — remove `pet_appearance_profile` references, clean up prompts
- `src/pages/ProjectGenerating.tsx` — handle story failure by setting phase to `"failed"` and allowing retry of the story step

## Technical Details

In `generate-story/index.ts`:
- Line 83: Remove `project.pet_appearance_profile` from log
- Line 85: Change to `buildSystemPrompt(project.pet_name, null)`
- Line 89: Remove the appearance profile block from user prompt

In `ProjectGenerating.tsx`:
- Lines 236-241: After `storyErr`, set `setPhase("failed")` and return, so the UI shows the failure state with a retry option
- Add a `retryStory` handler that re-invokes `generate-story` and then proceeds to illustrations
