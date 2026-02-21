

# Fix: Photo Drop Fails on Non-Existent Project

## What's Happening

You're on a project URL (`/project/da5d0996-...`) for a project that no longer exists in the database. When you drop a photo, the app sees a project ID in the URL and tries to upload directly to it -- but the database rejects the insert because that project doesn't exist.

The file itself uploads to storage fine, but the database record fails, so the photo never appears.

## Root Cause

The `handlePhotoUpload` function checks if `activeProjectId` is set. If it is, it skips creating a new project and uploads straight to that ID. But there's no guard to verify the project actually exists before uploading.

## The Fix

**File: `src/pages/PhotoRabbit.tsx`** -- Add a guard in `handlePhotoUpload`:

- When `activeProjectId` is set but `project` is undefined (meaning the useProject query returned nothing), treat it the same as having no project: clear `activeProjectId`, create a fresh project, navigate to it, then upload.

Specifically, change the upload handler so that when `pid` is set but `project` is falsy (line ~238), it:
1. Resets `activeProjectId` to null
2. Sets `pid` to null
3. Falls through to the "create new project" branch (which already works correctly)

This is a ~3 line change. The existing project creation and upload flow handles everything after that.

## Secondary Fix: Redirect Away from Dead Project URLs

**Same file** -- In the `useEffect` that syncs `paramId` (line 150-153), add a check: if `paramId` is set but the project query has finished loading and returned no data, navigate back to `/` so the user lands on the home screen instead of staring at a broken state.

## Files Changed

| File | What Changes |
|------|-------------|
| `src/pages/PhotoRabbit.tsx` | Guard in `handlePhotoUpload` for non-existent projects; redirect effect for dead URLs |

## What Does NOT Change
- Project creation flow
- Upload pipeline
- RLS policies (they're correct -- the project genuinely doesn't exist)
- Any other files

