

# Show All Photos with Scroll (Instead of Capping at 12)

## Problem

The `PhotoUploadInline` component hard-caps the photo grid at 12 items (`photos.slice(0, 12)`) and shows a "+67" badge for the rest. You can't see, favorite, or delete the hidden photos.

## Solution

Remove the `slice(0, 12)` limit and render all photos in a scrollable grid. Add a max-height container with overflow scroll so the grid doesn't take over the whole page.

## Changes

### File: `src/components/workspace/PhotoUploadInline.tsx`

1. **Remove the `.slice(0, 12)`** on line 79 -- render all photos instead of just the first 12
2. **Remove the "+N" overflow badge** (the block at lines 120-129 that shows "+67")
3. **Wrap the grid in a scrollable container** with `max-h-[400px] overflow-y-auto` so that when there are many photos, the grid scrolls instead of pushing everything else off screen
4. Optionally bump grid to 5 columns on larger screens for better density (`grid-cols-4 sm:grid-cols-5 lg:grid-cols-6`)

This way you can see every photo, hover to delete or favorite any of them, and the upload zone + "let's go" button remain accessible above/below the scrollable area.

