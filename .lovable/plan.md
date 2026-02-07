

# Fix Minor Issues in Your GitHub Code

Your GitHub push is clean and working. There's only **one small bug** to fix:

## Bug: Book Preview doesn't reset to page 1

When you close and reopen the Preview dialog, it stays on whatever page you were last viewing instead of starting from page 1. This needs a `useEffect` to reset the page index when the dialog opens.

## Change

**`src/components/project/BookPreview.tsx`** -- Add a `useEffect` and keyboard navigation:
- Import `useEffect` and `useCallback`
- Reset `current` to 0 when `open` becomes true
- Add arrow key navigation (Left/Right) and Escape to close

That's the only fix needed. Everything else in your code is solid:
- `ProjectReview.tsx` works correctly with broken image detection and "Generate Missing" logic
- `ProjectGenerating.tsx` has smart resume and retry -- all good
- `BookPageViewer.tsx` has the `onImageError` handler intact
- The removed `pet_appearance_profile` column has no references anywhere
- `PrintableBook` and `window.print()` are correctly wired up

