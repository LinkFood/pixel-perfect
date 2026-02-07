
# Build It All: Illustrations, Book Preview, Export, and Polish

Everything needed to go from uploaded photos to a finished book you can see and download. One shot, build it, fix later.

---

## What You'll Get When This Is Done

1. After the interview, story generation creates text AND illustrations for all 24 pages
2. The review page shows real AI-generated artwork on every page
3. You can regenerate any single page's text or illustration
4. A full-screen book preview lets you flip through the finished product
5. A "Download / Print" button exports the whole book as a PDF
6. Back buttons on every step so you're never stuck
7. Delete projects from the dashboard when you're done with them

---

## 1. Illustration Generation

**New edge function: `generate-illustration`**
- Takes a page ID, fetches its `illustration_prompt` and `scene_description`
- Calls `google/gemini-3-pro-image-preview` to generate an illustration
- The base64 image comes back, gets uploaded to the `pet-photos` storage bucket under `illustrations/{projectId}/{pageId}.png`
- Saves a record in `project_illustrations` table
- Returns the storage path

**Update: Story generation flow (`ProjectGenerating.tsx`)**
- Two-phase progress bar:
  - Phase 1: "Writing your story..." with page count (existing behavior)
  - Phase 2: "Creating illustrations..." with illustration count (new)
- After story text finishes, automatically calls `generate-illustration` for each page sequentially (to avoid rate limits)
- Listens for realtime inserts on `project_illustrations` to update progress
- Only shows "Review Your Book" button after both phases complete

**Database migration:**
- Enable realtime on `project_illustrations` table

---

## 2. Display Real Illustrations in Review

**Update: `BookPageViewer` component**
- Accept an optional `illustrationUrl` prop
- If an illustration exists, show the actual image instead of the placeholder icon
- Smooth fade-in when the image loads

**Update: `ProjectReview` page**
- Fetch illustrations from `project_illustrations` alongside pages
- Pass illustration URLs to `BookPageViewer`
- Add "Regenerate Illustration" button on `PageEditor` that calls `generate-illustration` again for that page

---

## 3. Single Page Regeneration

**New edge function: `regenerate-page`**
- Takes a page ID and project ID
- Fetches project info, interview transcript, and the surrounding 2 pages for context
- Calls GPT-5.2 to regenerate just that one page's `text_content` and `illustration_prompt`
- Updates the `project_pages` row
- Returns the updated page data

**Update: `PageEditor` component**
- Add "Regenerate Text" button that calls `regenerate-page`
- Add "Regenerate Illustration" button that calls `generate-illustration`
- Show loading spinners while regenerating

---

## 4. Book Preview and PDF Export

**New component: `BookPreview`**
- Full-screen dialog/modal
- Shows each page as a spread: illustration on top, text below
- Previous/Next navigation with page counter
- Clean, immersive reading experience

**New component: `PrintableBook`**
- Hidden component rendered only for printing
- All 24 pages laid out with CSS page breaks
- Each page: full illustration + text content
- Triggered via `window.print()` with `@media print` CSS rules

**Update: `ProjectReview` page**
- Add "Preview Book" button that opens the BookPreview modal
- Add "Download / Print" button that triggers the PrintableBook print flow

---

## 5. Navigation and Flow Polish

**Back buttons on every step page:**
- Upload page: back arrow to Dashboard
- Interview page: back arrow to Upload
- Generating page: (no back -- generation is in progress)
- Review page: back arrow to Dashboard

**Project deletion from Dashboard:**
- Trash icon on each project card (visible on hover)
- Confirmation dialog before deleting
- Deletes: project row, all photos (storage + DB rows), interview messages, pages, illustrations
- New `useDeleteProject` hook in `useProject.ts`

**Update: `ProjectStatusBadge`**
- No changes needed, already handles all statuses

---

## Build Sequence (all in one shot)

1. Database migration: enable realtime on `project_illustrations`
2. New edge function: `generate-illustration`
3. New edge function: `regenerate-page`
4. Update `supabase/config.toml` with new functions
5. Update `ProjectGenerating.tsx` with two-phase progress
6. Update `BookPageViewer.tsx` to show real illustrations
7. Update `PageEditor.tsx` with regeneration buttons
8. Update `ProjectReview.tsx` to fetch illustrations and wire up regeneration
9. New component: `BookPreview.tsx`
10. New component: `PrintableBook.tsx`
11. Update `ProjectUpload.tsx` and `ProjectInterview.tsx` with back navigation
12. Add `useDeleteProject` to `useProject.ts`
13. Update `Dashboard.tsx` with delete functionality

---

## Technical Notes

- Illustrations use `google/gemini-3-pro-image-preview` -- higher quality image generation model
- Images are generated sequentially (one at a time) to avoid hitting rate limits on the AI gateway
- Base64 image data from the AI is uploaded to storage immediately and never stored in the database
- The `project_illustrations` table already has the right schema (page_id, project_id, storage_path, generation_prompt, is_selected)
- PDF export uses zero additional dependencies -- pure CSS `@media print` with `window.print()`
- Project deletion cascades manually through all related tables since there are no DB-level cascades
- Realtime on `project_illustrations` uses the same pattern as `project_pages` in the generating page
