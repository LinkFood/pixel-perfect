

# Add Dev Tools and Auto-Fill Chat

## What This Does
Expands the existing dev toolbar so it's available in more phases and adds the ability to auto-fill the chat conversation (not just the interview database messages). Right now the dev toolbar only appears during the "interview" phase -- this will make it accessible across all workspace phases.

## Changes

### 1. Expand Dev Toolbar Visibility
Currently the dev toolbar (Auto-fill, Clear buttons) only shows when `phase === "interview"`. Update this condition so it shows in all active phases: `upload`, `mood-picker`, `interview`, and `generating`.

### 2. Add "Auto-Fill Chat" to Dev Toolbar
Add a button that populates the visible chat messages with seed data so you can quickly test the chat UI without waiting for AI responses. This will:
- Insert pre-built chat messages into the `chatMessages` state
- Work alongside the existing database-level auto-fill (which seeds `project_interview` table rows)

### 3. Add Phase Skip Buttons
Add dev-only buttons to jump between phases:
- "Skip to Interview" -- sets project status to `interview`
- "Skip to Generating" -- sets project status to `generating`
- These only show when relevant (e.g., skip to interview only shows during upload/mood-picker)

### 4. Add Pricing Route (currently 404)
The user is on `/pricing` which doesn't exist. Add a placeholder pricing page route.

## Technical Details

**Files modified:**
- `src/components/workspace/Workspace.tsx` -- Expand dev toolbar condition from `phase === "interview"` to include `upload`, `mood-picker`, `interview`, `generating`. Add phase-skip buttons and chat auto-fill button.
- `src/App.tsx` -- Add `/pricing` route pointing to a new Pricing page.
- `src/pages/Pricing.tsx` (new) -- Simple placeholder pricing page.

**No database changes needed.** All dev tools use existing hooks (`useAutoFillInterview`, `useClearInterview`, `useUpdateProjectStatus`).

