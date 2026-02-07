

# Fix Blank Illustrations

## Problem
Every single generated illustration (all 15 out of 15) is a blank/white/corrupt PNG file. The AI gateway returns images successfully (no errors in logs), but the saved files contain no visible content. The base64 decoding and upload process is silently producing garbage data.

## Root Cause Analysis
The `generate-illustration` edge function extracts base64 from the AI gateway response and converts it to bytes via `atob()`. The likely issues:

1. **Whitespace/newlines in base64**: The base64 string from the gateway may contain line breaks or whitespace that need to be stripped before `atob()` can decode properly
2. **Content type mismatch**: The image may be JPEG but is saved as `image/png`
3. **No validation**: The function never checks if the decoded data is actually a valid image (e.g., checking PNG magic bytes or minimum file size)

## Fix Plan

### 1. Fix the edge function (`supabase/functions/generate-illustration/index.ts`)

**Add debug logging** to capture the actual response structure (first 200 chars of base64, total length, first few bytes after decode) so we can verify the fix works.

**Strip whitespace from base64** before decoding:
```
base64Data = base64Data.replace(/\s/g, '');
```

**Detect actual image type** from the data URI prefix (image/png vs image/jpeg) and use the correct content type for upload.

**Validate the decoded image** by checking:
- Minimum byte size (a real image should be at least a few KB, not a few bytes)
- PNG magic bytes (`89 50 4E 47`) or JPEG magic bytes (`FF D8 FF`) at the start

**Handle the base64 properly**: Use `Uint8Array.from()` with proper chunking for very large base64 strings, since `atob()` can struggle with multi-megabyte strings in some runtimes.

### 2. Add a "regenerate corrupt" capability

Since all 15 existing illustrations are broken, the review page's "Generate Missing" button won't help — those pages already have illustration records. Add logic to detect and regenerate corrupt illustrations:

- In `ProjectReview.tsx`, when an illustration URL fails to load a valid image (via `onError` on the img tag), mark it as needing regeneration
- The "Generate Missing" button should also consider pages where the illustration exists but the image failed to load
- Alternatively, delete all existing corrupt illustration records so the "Generate Missing" flow picks them up

### 3. Clean up existing corrupt data

Delete all 15 corrupt illustration records for this project so the fixed function can regenerate them cleanly. This will be done by:
- Deleting records from `project_illustrations` for this project
- Deleting the corrupt files from storage
- The "Generate Missing" button (or generating page) will then re-process all 24 pages

## Technical Changes

**`supabase/functions/generate-illustration/index.ts`:**
- Add `base64Data = base64Data.replace(/[\s\n\r]/g, '')` before decoding
- Detect content type from data URI: parse `data:image/(png|jpeg|webp);base64,...` and use matched type
- Add size validation: if decoded bytes < 1000, log error and throw
- Add magic byte check for PNG/JPEG headers
- Log base64 length and first 50 chars for debugging
- Use proper binary conversion with chunked approach for large strings

**`src/pages/ProjectReview.tsx`:**
- Add `onError` handler to illustration images in BookPageViewer to detect broken images
- Modify missing count logic to include pages with broken illustrations

**`src/components/project/BookPageViewer.tsx`:**
- Add `onError` callback prop so parent can track which illustrations are broken

**One-time data cleanup:**
- Delete all illustration records for project `8df4f6bc` so they regenerate fresh
- Also clean up project `6e2439cd` which likely has the same issue

