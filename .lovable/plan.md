

# Resume Build: All Remaining Features

The database migration is already done (realtime enabled on `project_illustrations`). Now building all the code.

---

## Files to Create

### 1. Edge Function: `supabase/functions/generate-illustration/index.ts`
- Accepts `pageId` and `projectId`
- Fetches `illustration_prompt` and `scene_description` from `project_pages`
- Calls `google/gemini-3-pro-image-preview` via Lovable AI gateway with the prompt
- Extracts base64 image from response
- Uploads to `pet-photos` bucket at `illustrations/{projectId}/{pageId}.png`
- Inserts record into `project_illustrations` (page_id, project_id, storage_path, generation_prompt, is_selected=true)
- Deletes any previous illustration for the same page first (for regeneration support)

### 2. Edge Function: `supabase/functions/regenerate-page/index.ts`
- Accepts `pageId` and `projectId`
- Fetches project info, interview transcript, and surrounding pages for context
- Calls `openai/gpt-5.2` to regenerate that single page's `text_content` and `illustration_prompt`
- Updates the `project_pages` row
- Returns updated page data

### 3. Component: `src/components/project/BookPreview.tsx`
- Full-screen Dialog with dark overlay
- Shows each page: illustration image on top, text below
- Previous/Next navigation with page counter
- Close button

### 4. Component: `src/components/project/PrintableBook.tsx`
- Hidden div rendered off-screen, shown only during print
- All pages with CSS page breaks
- Each page: illustration + text
- Export triggered via `window.print()` with `@media print` styles

---

## Files to Update

### 5. `supabase/config.toml`
- Add `generate-illustration` and `regenerate-page` function entries (verify_jwt = false)

### 6. `src/pages/ProjectGenerating.tsx`
- Two-phase progress: story writing then illustration generation
- After `generate-story` completes, sequentially call `generate-illustration` for each page
- Listen for realtime inserts on `project_illustrations` for phase 2 progress
- Only show "Review" button after both phases complete

### 7. `src/components/project/BookPageViewer.tsx`
- Add optional `illustrationUrl` prop
- Show real image when available, placeholder when not
- Fade-in animation on image load

### 8. `src/components/project/PageEditor.tsx`
- Add "Regenerate Text" button (calls `regenerate-page`)
- Add "Regenerate Illustration" button (calls `generate-illustration`)
- Loading states for both

### 9. `src/pages/ProjectReview.tsx`
- Fetch illustrations from `project_illustrations` alongside pages
- Pass illustration URLs to `BookPageViewer`
- Wire regeneration callbacks to `PageEditor`
- Add "Preview Book" and "Download/Print" buttons in header
- Include `BookPreview` and `PrintableBook` components

### 10. `src/pages/ProjectUpload.tsx`
- Add back arrow link to `/dashboard`

### 11. `src/pages/ProjectInterview.tsx`
- Add back arrow link to `/project/{id}/upload`

### 12. `src/hooks/useProject.ts`
- Add `useDeleteProject` hook that deletes illustrations, pages, interview messages, photos (storage + DB), then the project row

### 13. `src/pages/Dashboard.tsx`
- Add trash icon on project cards (visible on hover)
- Confirmation dialog before delete
- Wire to `useDeleteProject`

---

## Technical Details

- `generate-illustration` uses the same Lovable AI gateway pattern as `describe-photo` and `generate-story`
- Images are generated one at a time (sequential loop in `ProjectGenerating`) to avoid rate limits
- Storage path: `illustrations/{projectId}/{pageId}.png` in the existing `pet-photos` public bucket
- `PrintableBook` uses CSS `@media print` with `page-break-after: always` -- zero new dependencies
- Project deletion order: illustrations -> pages -> interview -> photos (storage) -> photos (DB) -> project

