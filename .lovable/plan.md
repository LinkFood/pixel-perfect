

# Build It All: Illustrations, Book Preview, Export, and Polish

Resuming the approved plan. Everything needed to go from uploaded photos to a finished book you can see and download.

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

## Build Sequence (all in one shot)

1. Database migration: enable realtime on `project_illustrations`
2. New edge function: `generate-illustration` -- calls Gemini image model, uploads to storage, saves to DB
3. New edge function: `regenerate-page` -- regenerates a single page's text and illustration prompt
4. Update `supabase/config.toml` with new functions
5. Update `ProjectGenerating.tsx` with two-phase progress (story writing then illustration creation)
6. Update `BookPageViewer.tsx` to show real illustrations instead of placeholders
7. Update `PageEditor.tsx` with "Regenerate Text" and "Regenerate Illustration" buttons
8. Update `ProjectReview.tsx` to fetch illustrations and wire up regeneration
9. New component: `BookPreview.tsx` -- full-screen flip-through modal
10. New component: `PrintableBook.tsx` -- hidden print layout for PDF export via window.print()
11. Update `ProjectUpload.tsx` and `ProjectInterview.tsx` with back navigation
12. Add `useDeleteProject` to `useProject.ts`
13. Update `Dashboard.tsx` with delete functionality (trash icon, confirmation dialog)

---

## Technical Notes

- Illustrations use `google/gemini-3-pro-image-preview` through Lovable AI gateway (no API key needed)
- Images generated sequentially (one at a time) to avoid rate limits
- Base64 image data uploaded to storage immediately, never stored in database
- `project_illustrations` table already exists with correct schema
- PDF export uses zero additional dependencies -- pure CSS @media print with window.print()
- Project deletion cascades manually through all related tables
- Realtime on `project_illustrations` uses same pattern as `project_pages`

