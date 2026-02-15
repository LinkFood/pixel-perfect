

# Fix: Broken Flow, Stale Greeting, and Add Dev Error Visibility

## What's Actually Broken

### 1. Stale greeting bubble
`getRabbitGreeting()` returns `null` for `interview` and `mood-picker` phases (lines 650-678). The `useEffect` that injects the greeting skips when greeting is `null`, so the first chat message stays as "Ready when you are -- drop some photos" even after photos are uploaded and the phase changes. The user sees a lie.

**Fix:** Remove the greeting injection mechanism entirely. It's causing more problems than it solves -- it overwrites the first message on every phase change. Instead, inject greeting messages at the correct moments (project creation, photo analysis completion, phase transitions) as one-time events.

### 2. No error visibility for development
When things fail (edge functions, mutations, phase transitions), there's zero feedback. The user stares at a screen that looks frozen.

**Fix:** Add a persistent dev status bar (only in dev mode) at the top of the workspace showing:
- Current phase (color-coded)
- Project status from DB
- Photo count
- Mood value
- Last error (if any)

Also add `toast.error()` calls to all failure paths that currently fail silently.

### 3. Interview greeting never fires on fresh flow
When `startInterview(mood)` is called (line 472), it sets `chatMessages` to a single greeting. But `getRabbitGreeting` `useEffect` (line 683) immediately overwrites it because the greeting changed (phase is now interview, returning `null`). This race condition can clear the interview greeting.

**Fix:** Same as #1 -- remove the auto-updating greeting useEffect. One-time injections only.

---

## Technical Changes

### File: `src/pages/PhotoRabbit.tsx`

**Remove the `getRabbitGreeting` + auto-injection system (lines 649-697)**
- Delete `getRabbitGreeting` callback
- Delete `lastGreetingRef` and the useEffect that uses it
- Instead, inject a welcome message ONCE when a project is first loaded and chatMessages is empty:
  ```
  useEffect: if chatMessages.length === 0 && project exists:
    if phase is "interview" and mood is set: inject interview greeting
    if phase is "mood-picker": inject mood picker message
    if phase is "upload" or "home": inject "drop photos" message
    if phase is "generating": inject "painting your book" message
    if phase is "review": inject "book is ready" message
  ```
  This runs once per project load, not on every re-render.

**Add error toasts to silent failure paths:**
- `handlePhotoUpload` catch block (line 266): already has toast -- good
- `handleMoodSelect` (line 463): wrap in try/catch, add `toast.error("Couldn't save mood -- try again")`
- `handleContinueToInterview` (line 442): add error handling for `updateStatus.mutate`
- `handleFinishInterview` catch paths: already have chat messages -- also add toasts

**Add dev status bar:**
- New component `DevStatusBar` rendered at top of workspace (inside `WorkspaceSandbox` or at the layout level)
- Shows: `phase | status: {db_status} | mood: {mood} | photos: {count} | errors: {last_error}`
- Only renders when `isDevMode()` is true
- Bright colored background so it's impossible to miss

### File: `src/components/workspace/WorkspaceSandbox.tsx`

**No structural changes needed** -- the workspace layout is correct (photos visible during interview). Just need the dev status bar added.

### Summary

| File | Change |
|------|--------|
| `src/pages/PhotoRabbit.tsx` | Remove auto-updating greeting system, replace with one-time injection per project load. Add toast.error to failure paths. Add DevStatusBar component. |
| `src/components/workspace/WorkspaceSandbox.tsx` | Add DevStatusBar rendering at top when in dev mode |

