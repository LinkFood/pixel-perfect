

# Fix Photo Upload in Dev Mode

## Problem

Dev mode bypasses the login screen, but when you drop photos, the app tries to create a project via `useCreateMinimalProject` which calls `supabase.auth.getUser()`. Since there's no real auth session, it throws **"Not authenticated"** and the upload fails.

## Solution

Make `useCreateMinimalProject` work without authentication when dev mode is active by inserting the project row with `user_id` set to a fixed dev placeholder UUID instead of requiring a real user.

## Changes

### 1. `src/hooks/useProject.ts` -- Update `useCreateMinimalProject`

- Import `isDevMode` from `@/lib/devMode`
- In the `mutationFn`, if `isDevMode()` is true, skip the `supabase.auth.getUser()` call and use a hardcoded dev UUID (e.g., `"00000000-0000-0000-0000-000000000000"`) as the `user_id`
- This allows project creation and photo uploads to work in dev mode without a real session

### 2. `src/hooks/usePhotos.ts` -- Check if upload also requires auth

- Review the upload function; if it also calls `getUser()`, apply the same dev mode bypass so photo storage uploads succeed
- Supabase Storage RLS may block anonymous uploads -- if so, the upload bucket policy may need a tweak for the dev user ID

### 3. Database consideration

- The `projects` table likely has RLS policies requiring `auth.uid()`. In dev mode, queries will also fail since there's no session.
- Add a simple RLS policy (or adjust existing ones) to allow the dev UUID to read/write, **or** use the Supabase service role in dev mode edge cases.
- Alternatively, the simplest fix: use `supabase.auth.signInWithPassword` with a pre-seeded dev account automatically when dev mode activates, giving a real session without the user needing to type credentials.

## Recommended Approach: Auto-sign-in for Dev Mode

The cleanest fix is to **auto-sign-in a dev test account** when dev mode is activated. This gives a real Supabase session so all existing code (RLS, storage, edge functions) works without any changes.

1. **Create a dev test account** in the database (email: `dev@photorabbit.test`, password: `devmode123`)
2. **Update `src/pages/Home.tsx`** -- when `isDevMode()` is true and `user` is null, auto-call `signIn("dev@photorabbit.test", "devmode123")` before rendering the Workspace
3. Everything else (project creation, photo upload, interview, generation) works as-is because there's now a real auth session

## Technical Steps

1. Create a migration to seed a dev user (or just sign up once manually via the auth API)
2. In `Home.tsx`, add a `useEffect` that detects dev mode + no user and calls `supabase.auth.signInWithPassword` with the dev credentials
3. Show a brief loading spinner while the auto-sign-in completes
4. Once signed in, `Workspace` renders normally with full database access

