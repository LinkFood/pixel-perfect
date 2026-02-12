
# Restore Auto-Fill Dev Tools in Workspace

## What Happened

The auto-fill interview feature (the dropdown that let you pick Link/Luna/Max seed data to skip the chat) was removed when the Workspace component was refactored. The backend hooks (`useAutoFillInterview`, `useClearInterview`) still exist in `useInterview.ts` -- they just aren't wired up to any UI anymore.

## Fix

Add a dev-only toolbar to the interview view in `Workspace.tsx` that shows when `isDevMode()` is true.

### Changes to `src/components/workspace/Workspace.tsx`

1. Import `isDevMode` from `@/lib/devMode`
2. Import `useAutoFillInterview`, `useClearInterview`, and `SeedOption` from `@/hooks/useInterview`
3. Add state for the seed dropdown (`seedMenuOpen`)
4. Wire up the auto-fill and clear mutations with `resolvedId`
5. In the interview view, render a small dev toolbar (only when `isDevMode()`) above the chat input with:
   - A dropdown button to pick a seed (Link full / Luna cat / Max short)
   - A "Clear" button to reset the interview
   - After auto-fill completes, also update `chatMessages` local state from the DB so the filled messages appear immediately

The toolbar will be styled subtly (small text, muted colors) so it doesn't interfere with the main UI but is easy to use during testing.
