

# Full AI Chain Dev Log and Observability Panel

## Overview

Build a complete chain logging system that captures every AI call across the pipeline with full input/output visibility, accessible via a collapsible dev panel.

## New Files

### 1. `src/hooks/useChainLog.tsx` -- Context + Hook

- Define `ChainEvent` interface with all specified fields (id, timestamp, phase, step, status, durationMs, input, output, model, tokenCount, costCents, errorMessage, metadata)
- Create `ChainLogContext` with React.createContext
- `ChainLogProvider` component holds `events` in useState
  - `addEvent(partial)` -- generates UUID, sets timestamp, pushes to state, returns id
  - `updateEvent(id, partial)` -- merges partial into matching event
  - `clearLog()` -- resets to empty array
- `useChainLog()` hook consumes the context, throws if used outside provider
- Provider wraps at `WorkspaceSandbox` level (not App level -- keeps it scoped to the workspace)

### 2. `src/components/workspace/ChainLogPanel.tsx` -- Dev UI

- Collapsible panel, dark `bg-gray-950` background, monospace font, fixed height (`max-h-96`), scrollable
- **Header toolbar:**
  - Filter chips: All | Errors Only | photo-analysis | interview | story | illustration
  - Clear button, Copy All (JSON to clipboard), Export (.json download)
- **Event rows:** `[HH:mm:ss] [STATUS badge] [phase] > [step] [model] [duration] [tokens] [cost]`
  - Status color: pending=`text-gray-400`, running=`text-yellow-400 animate-pulse`, success=`text-green-400`, error=`text-red-400`
  - Error rows get `bg-red-950/50` background
  - Click to expand: shows full INPUT and OUTPUT in scrollable `pre` blocks, plus metadata JSON
- Zero external dependencies -- uses existing Tailwind, Framer Motion for expand/collapse

### 3. Upgraded `src/components/workspace/DevStatusBar.tsx`

Keep existing phase/db/mood/photos display. Add:
- Live token counter: sum of all `tokenCount` values from chain events
- Live cost counter: sum of `costCents`, displayed as `$X.XX`
- Error badge: red `text-red-400` badge showing error count (if any)
- Toggle button: "Chain Log (N)" that opens/closes the ChainLogPanel below

DevStatusBar receives `useChainLog()` data and the panel toggle state.

## Wiring -- Edge Function Call Sites

Every call site gets wrapped with `addEvent` before the call and `updateEvent` after. All wiring is guarded by `isDevMode()` so production has zero overhead.

### File: `src/hooks/usePhotos.ts`
**`describePhoto()` (line 44-83)**
- Phase: `photo-analysis`, Step: `describe-photo`
- Input: `photoId + projectId`
- Output: response body (caption + ai_analysis)
- Model: `Gemini 2.5 Flash`
- Hook access: `useChainLog` called at hook level, passed down via closure

### File: `src/hooks/useInterview.ts`
**`sendMessage()` (line 136-239)**
- Phase: `interview`, Step: `interview-chat turn N`
- Input: user message + truncated context
- Output: assistant reply (after stream completes)
- Model: `GPT-5.2`
- Duration: measured from fetch start to stream end

### File: `src/pages/PhotoRabbit.tsx`
**`handleContinueToInterview` / `handleMoodSelect` (lines 561, 571)**
- `build-appearance-profile` call
- Phase: `appearance-profile`, Step: `build-appearance-profile`
- Input: projectId
- Output: profile result
- Model: `Gemini 2.5 Flash`

**`handleGenerationComplete` (line 755)**
- `create-share-link` call
- Phase: `system`, Step: `create-share-link`
- Lightweight log, no model field

### File: `src/components/workspace/GenerationView.tsx`
**`generate-story` (line 596)**
- Phase: `story`, Step: `generate-story`
- Input: projectId
- Output: story result
- Model: `GPT-5.2`

**`generate-illustration` in `generateIllustrations()` (line 515)**
- Phase: `illustration`, Step: `generate-illustration page N`
- Input: pageId + projectId
- Output: success/error + storage path
- Model: `Gemini 3 Pro`

**`generate-illustration` variant calls (line 421)**
- Phase: `illustration`, Step: `generate-illustration-variant page N`
- Fire-and-forget logging (addEvent with status running, no guaranteed update)

### File: `src/components/project/BookReview.tsx`
**`handleTryAnother` (line 239)**
- Phase: `illustration`, Step: `try-another-variant`

**`handleRegenerateText` (line 328)**
- Phase: `story`, Step: `regenerate-page-text`
- Model: `GPT-5.2`

**`handleRegenerateIllustration` (line 343)**
- Phase: `illustration`, Step: `regenerate-illustration`

**`handleGenerateMissing` (line 370)**
- Phase: `illustration`, Step: `generate-missing page N`

**`handleRebuildProfile` (line 496)**
- Phase: `appearance-profile`, Step: `rebuild-appearance-profile`

## Provider Placement

In `WorkspaceSandbox.tsx`, wrap the entire return JSX with `<ChainLogProvider>`. The `DevStatusBar` and `ChainLogPanel` sit inside this provider and can access events directly via `useChainLog()`.

For hooks that need chain log access (`usePhotos`, `useInterview`), the `useChainLog` hook will be called conditionally: a try/catch wrapper that returns no-ops if the context isn't available (since these hooks can be used outside the provider). Alternatively, a `useChainLogSafe()` variant that returns no-op functions when outside the provider.

## Technical Details

- **UUID generation:** `crypto.randomUUID()` (already used elsewhere in the codebase)
- **Truncation:** Input/output truncated to 500 chars for display, full content stored in event
- **isDevMode() guard:** All `addEvent`/`updateEvent` calls wrapped in `if (isDevMode())` so production code never touches the logger
- **No DB persistence:** Pure in-memory React state. Export/copy features let devs save snapshots manually
- **Bundle safety:** ChainLogPanel lazy-loaded or wrapped in `isDevMode()` conditional render so it tree-shakes in production

## Implementation Order

1. Create `useChainLog.tsx` (context + provider + hook)
2. Create `ChainLogPanel.tsx` (UI component)
3. Update `DevStatusBar.tsx` (add counters + toggle)
4. Update `WorkspaceSandbox.tsx` (wrap with provider, render panel)
5. Wire `usePhotos.ts` (describe-photo logging)
6. Wire `useInterview.ts` (interview-chat logging)
7. Wire `GenerationView.tsx` (story + illustration logging)
8. Wire `PhotoRabbit.tsx` (appearance-profile + share-link logging)
9. Wire `BookReview.tsx` (regenerate + variant logging)

