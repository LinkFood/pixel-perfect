

# Fix Build Error + Flow Bug in Mood Selection

## Bugs Found

### Bug 1: Build Error (Critical)
`handleMoodSelect` calls `setShowMoodPicker(false)` on line 228 -- this state variable was removed in the flow refactor. This completely breaks the build.

### Bug 2: Wrong Flow After Mood Selection
`handleMoodSelect` calls `startInterview()` immediately after picking a mood. This skips the photo upload step entirely. Per your intended flow, selecting a mood should just save the mood and let the view auto-resolve to "upload" (since the view logic already does `!project.mood ? "mood-picker" : status === "upload" ? "upload"`).

## Fix

### File: `src/components/workspace/Workspace.tsx`

Replace `handleMoodSelect` (lines 225-230) with a simpler version that only saves the mood and name to the database -- no `setShowMoodPicker`, no `startInterview`:

```typescript
const handleMoodSelect = (mood: string, name: string) => {
  if (!activeProjectId) return;
  updateProject.mutate({ id: activeProjectId, mood, pet_name: name });
  // View auto-resolves: mood is now set -> falls through to "upload" view
};
```

That's it -- two lines removed, build error fixed, and the flow now correctly goes mood -> upload -> interview.

## Your Vision (as I understand it)

You're building a creative studio where users:
1. Drop photos and create a project
2. Pick a mood/tone for their book
3. Upload more photos
4. Chat with Rabbit about their memories
5. Watch the book get illustrated
6. Review and approve every page

All of this happens in a single workspace with project tabs at the bottom for quick switching, renaming, and cleanup -- no need to navigate away to manage projects.
