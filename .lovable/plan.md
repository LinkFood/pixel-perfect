

# Fix Dev Mode Exit + Reorder Flow (Mood Before Photos)

## Problem 1: Can't Exit Dev Mode
Once dev mode is activated, the user auto-signs in and goes straight to Workspace -- they never see the Landing page (which has the only "Dev" button). There's no way to turn it off.

**Fix**: Add a small "Exit Dev Mode" button in the MinimalNav component (only visible when dev mode is active). Clicking it calls `disableDevMode()`, signs out, and reloads.

## Problem 2: Mood Picker Should Come Before Photo Upload
The user wants the flow to be: **create project -> pick mood -> upload photos -> interview**, not the current create project -> upload photos -> pick mood -> interview.

**Fix**: Restructure the Workspace view logic so:
1. When a new project is created (home view), immediately show the mood picker
2. After mood is selected, transition to the upload view
3. After photos are uploaded and user clicks "That's all my photos," go straight to interview (skip mood picker since it's already done)

## Problem 3: Missing `mood` Column in Database
The code references `project.mood` but the column doesn't exist in the database, causing all mood saves to silently fail.

**Fix**: Add a database migration: `ALTER TABLE public.projects ADD COLUMN mood text;`

## Changes Summary

### Database Migration
```sql
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS mood text;
```

### `src/components/workspace/MinimalNav.tsx`
- Add a "Exit Dev Mode" button (only visible when `isDevMode()` is true)
- On click: call `disableDevMode()`, sign out, reload page

### `src/components/workspace/Workspace.tsx`
- Reorder the view logic: after project creation, show mood picker first
- After mood is selected, transition to "upload" status
- `handleContinueToInterview`: remove the mood picker check (mood is already set), go straight to interview
- Update `handleNewProject` / auto-create flow to show mood picker immediately
- The view priority becomes: no project -> "home", project with no mood -> "mood-picker", project status "upload" -> "upload", etc.

### Flow Diagram (new)

```text
[Home / Drop photos] --> [Mood Picker] --> [Photo Upload] --> [Interview] --> [Generating] --> [Review]
```

The mood picker appears right after the project is created (either by dropping first photos or clicking new project). Once mood is saved, the user moves to the upload view where they can add more photos. The "That's all my photos" button now goes directly to interview since mood is already set.

