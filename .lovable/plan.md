
# Two Problems, Two Fixes

## Problem 1: Can't Get Back Into Dev Mode

The `devMode.ts` file supports two activation methods:
- Append `?dev=1` to the URL (sets localStorage then reads it)
- Call `enableDevMode()` directly from code

But there is no button or link in the UI to re-enable it once the "Exit Dev" button has cleared it. The user has to know to type `/?dev=1` in the address bar.

**Fix:** Add a small hidden "Dev" link in the footer of the hero landing page. It should be subtle (tiny, muted text at the very bottom of the `HeroLanding` component) so real users won't notice it, but it lets you click back into dev mode without needing to remember the URL param trick.

When clicked, it calls `enableDevMode()` and then `window.location.reload()` — which triggers the existing `?dev=1`→localStorage→auto-sign-in flow.

We'll add it as a tiny footer text at the bottom of `HeroLanding.tsx`.

---

## Problem 2: Books Not Showing Up

The database confirms:
- Your 2 books ("baby jac", "Jac goes to the ball park") are stored under user `706b3f84` — which is an **anonymous** user account created Feb 15
- When you exited dev mode, the app signed out and then auto-created a **brand new** anonymous session with a different user ID
- RLS policies on the `projects` table enforce `auth.uid() = user_id` — so the new anonymous session has zero projects

This is the fundamental problem with anonymous sessions: they are disposable and don't carry over between sessions.

The books are NOT lost — they are still in the database. They just belong to the old anonymous session which is now gone.

**Fix Options:**

The cleanest fix for the dev workflow is to make the **dev mode account** (`dev@photorabbit.test`) be the one that has all the test books, instead of anonymous sessions. Since you're now re-entering dev mode and it signs into `dev@photorabbit.test`, all future test books will persist under that account.

For your existing two books — we can migrate them from the old anonymous user ID to the dev account via a one-time SQL update. Since this is a dev environment, that's safe to do.

For the broader product (real users), this is the standard argument for encouraging sign-up: anonymous sessions are ephemeral, and once the session cookie is gone, the data can't be recovered without linking to an email. This is a feature we'll want to address for real users eventually (e.g., "Sign up to save your book"), but for now the dev mode fix is the priority.

---

## Technical Changes

### Change 1: `src/components/workspace/HeroLanding.tsx`
Add a tiny "Dev" link at the very bottom of the component:

```tsx
{/* Hidden dev mode re-entry — small and subtle, invisible to real users */}
<button
  onClick={() => {
    enableDevMode();
    window.location.href = "/?dev=1";
  }}
  className="font-body text-[9px] text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors mt-2"
>
  dev
</button>
```

This button is nearly invisible (`text-[9px]` + `opacity-20`) but clickable. Clicking it enables dev mode and navigates to `/?dev=1`, which triggers the existing auto-sign-in to `dev@photorabbit.test`.

### Change 2: One-time SQL migration (run in database)
Reassign the 2 existing books from the old anonymous user to the dev account:

```sql
UPDATE projects
SET user_id = '9597962a-ba4e-46b5-9f26-9dcd4e982f4c'  -- dev@photorabbit.test
WHERE user_id = '706b3f84-274e-4ffb-8aa8-67886497713f'  -- old anonymous session
AND id IN (
  'a66dbf42-1335-47d7-9d3a-1510eb2ec580',  -- baby jac
  'a1fd6923-fa16-4948-9960-62830428908f'   -- Jac goes to the ball park
);
```

This also needs to update the related child records (photos, pages, illustrations, interview). We'll do a cascade migration of all 5 tables.

### No change to RLS or auth logic — the existing system is correct
The anonymous sign-in behavior is working as designed. The dev mode account is the right place to keep test data. Going forward, all books made in dev mode will persist under `dev@photorabbit.test`.

---

## Summary

| Problem | Root Cause | Fix |
|---|---|---|
| Can't re-enter dev mode | No UI button to call `enableDevMode()` | Add hidden "dev" link to hero footer |
| Books disappeared | Anonymous session changed, new session has different user ID; RLS blocks cross-user access | Migrate old books to dev account via SQL; dev mode always uses `dev@photorabbit.test` going forward |

Both fixes are small and targeted. The dev mode link change is one file. The migration runs as a database operation.
