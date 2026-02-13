
# Push Verification: Split Layout + Anonymous Auth + Credit Gate

## Build Status
The app renders correctly with the split layout (chat left, sandbox right). No breaking errors in the console.

## Three Issues Found

### 1. Anonymous Sign-Ins Disabled (BLOCKER)
Auth logs show repeated `422: anonymous_provider_disabled` errors. The `useAuth` hook calls `signInAnonymously()` but anonymous sign-ins are not enabled in the backend auth settings. Without this, unauthenticated visitors get no session and can't upload photos or create projects.

**Fix:** Enable anonymous sign-ins in the authentication configuration. This is a config change, not a code change.

### 2. `deduct_credit` Function Signature Mismatch (WILL CRASH)
The code in `useAuth.ts` calls:
```
supabase.rpc("deduct_credit", { p_user_id: user.id, p_amount: amount })
```
But the actual database function signature is:
```
deduct_credit(p_user_id uuid, p_project_id uuid, p_description text)
```
It expects `p_project_id` and `p_description`, not `p_amount`. The function always deducts exactly 1 credit. This will fail when users try to generate a book.

**Fix:** Update the `deduct` function call to pass `p_project_id` and `p_description` instead of `p_amount`. The `handleFinishInterview` in `PhotoRabbit.tsx` also needs to pass `activeProjectId` to `deduct()`.

### 3. Missing `handle_new_user_credits` Trigger (NO AUTO-CREDITS)
The database has the `handle_new_user_credits` function defined, but the triggers section shows "There are no triggers in the database." This means new users (including anonymous ones) will NOT automatically get 3 starter credits. They'll hit the credit gate immediately.

**Fix:** Create the trigger:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();
```

## What's Working
- Split layout renders correctly (380px chat left, flex sandbox right)
- Rabbit character displays at correct size (80px desktop)
- Upload zone, chat input, and footer all render
- Dev toolbar code is in place (visible when dev mode activated)
- Phase derivation logic is correct
- Mobile responsive classes are set up
- Share loop code is wired (BookReview, SharedBookViewer, auto share link)
- Credit gate component exists and is wired into the chat flow

## Implementation Steps

1. Enable anonymous sign-ins in auth config
2. Create the `on_auth_user_created` trigger so new users get 3 credits
3. Fix `useAuth.ts` `deduct()` to match the actual DB function signature (pass project ID and description instead of amount)
4. Update `handleFinishInterview` in `PhotoRabbit.tsx` to pass `activeProjectId` to `deduct()`

## Technical Details

**Files to modify:**
- `src/hooks/useAuth.ts` -- Change `deduct(amount)` to `deduct(projectId, description)` matching the DB function `deduct_credit(p_user_id, p_project_id, p_description)`
- `src/pages/PhotoRabbit.tsx` -- Update `handleFinishInterview` to call `deduct(activeProjectId, "Book generation")` instead of `deduct(1)`

**Database changes:**
- Create trigger `on_auth_user_created` on `auth.users` table calling `handle_new_user_credits()`
- Enable anonymous sign-ins in auth configuration
