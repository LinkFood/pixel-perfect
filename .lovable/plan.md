
# Retry Failed Illustrations

## Problem
Credits are now active, but the illustration generation loop already completed — all 24 pages failed with 402 errors and there are 0 illustrations. The page moved to "done" state even though nothing was generated.

## Solution
Two changes to make the system resilient to failures like this:

### 1. Update `ProjectGenerating.tsx`
- After the illustration loop finishes, check how many illustrations were actually created
- If some failed, show a **"Retry Failed"** button instead of immediately marking as "done"
- The retry button re-runs the loop but only for pages that don't have an illustration yet
- Also skip the story phase on retry (pages already exist)

### 2. Update `ProjectReview.tsx`
- Add a **"Generate Missing Illustrations"** button in the header (only visible when some pages lack illustrations)
- This queries pages without a matching illustration and calls `generate-illustration` for each
- Shows a progress toast during generation

### 3. Smart resume on page load (`ProjectGenerating.tsx`)
- On mount, check if pages already exist (story already done) and if illustrations are missing
- If so, skip straight to illustration phase and only process pages without illustrations
- This handles the case where the user refreshes or navigates back to the generating page

## Technical Details

**ProjectGenerating.tsx changes:**
- Before starting, query existing pages and illustrations to determine what's already done
- If pages exist but illustrations are missing, skip to phase 2 and only loop over pages without an illustration record
- After the loop, count successes. If failures remain, show "Retry" button + error count
- "Retry" resets the loop for missing illustrations only

**ProjectReview.tsx changes:**
- Compare `pages` array to `illustrations` array to find missing ones
- Show "Generate Missing Illustrations" button with count badge when mismatches exist
- Button triggers sequential generation with a progress indicator

**No edge function changes needed** -- the `generate-illustration` function already works correctly (confirmed by test call).
