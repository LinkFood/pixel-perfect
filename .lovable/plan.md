

# Codebase Audit: Issues Found After External Push

## Critical Bugs (will break features for real users)

### 1. Shared Book Links Are Broken for Viewers
The `share-page` and `get-shared-book` edge functions are NOT listed in `supabase/config.toml`, which means they default to `verify_jwt = true`. When someone receives a shared book link:
- Social crawlers (Facebook, Twitter, iMessage) hit `share-page` with no JWT -- they get a 401
- The recipient opens the link in their browser, `SharedBookViewer` calls `get-shared-book` with no JWT -- 401 again
- `create-share-link` also handles auth internally but isn't in config.toml

**Fix:** Add all three sharing functions to `supabase/config.toml` with `verify_jwt = false`.

### 2. Missing Database Trigger for New User Credits
The `handle_new_user_credits()` function exists in the database, but there is **no trigger** attached to `auth.users` to fire it. New users will NOT receive their 3 free starter credits automatically.

The credit counter shows "3" in the current session because the anonymous user was likely created before the trigger was lost, or credits were seeded manually. Any NEW visitor will get 0 credits and be blocked at the generation step.

**Fix:** Create the trigger via a database migration:
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();
```

## Minor Issues (non-blocking, cosmetic)

### 3. Console Ref Warnings
Two `forwardRef` warnings appear in the console:
- `ChatMessage` component used inside `AnimatePresence` in `PhotoRabbitInner`
- `SleepZzz` component inside `RabbitCharacter`

These are harmless -- they don't affect functionality -- but they spam the console.

**Fix:** Wrap `ChatMessage` with `React.forwardRef`.

## What's Working Well

After reviewing all 11 edge functions, 6 hooks, 11 workspace components, 10 project components, all pages, CSS, and the database schema:

- Landing page / hero renders correctly with rabbit, speech bubbles, flipbook showcase, process strip, social proof ticker, and CTA
- Anonymous sign-in flow works
- Photo upload pipeline (batch upload, captioning, progress tracking) is solid
- Interview chat with streaming, mood-aware prompts, and message windowing looks correct
- Story generation with function calling and page insertion is well-structured
- Illustration generation with primary/fallback models, retry logic, and variant support is robust
- Book review with spread navigation, illustration swapping, regeneration, PDF download, and sharing UI is complete
- Generation view with realtime illustration tracking, cinematic reveal, and build log is polished
- Credit system with atomic deduction and gate UI works (once the trigger is restored)
- Shared book viewer with gift wrap styles, auto-flip, touch navigation, and viral CTA is complete
- Project shelf with rename, delete, and status indicators works
- Dev mode tools are comprehensive

## Implementation Steps

### Step 1: Fix sharing config (config.toml)
Add these entries:
```toml
[functions.share-page]
verify_jwt = false

[functions.get-shared-book]
verify_jwt = false

[functions.create-share-link]
verify_jwt = false
```

### Step 2: Restore credits trigger (database migration)
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();
```

### Step 3: Fix ChatMessage ref warning
Wrap the `ChatMessage` component in `React.forwardRef` so `AnimatePresence` can attach its ref.

## Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| Share functions missing from config.toml | Critical | All shared book links return 401 for recipients |
| Missing credits trigger | Critical | New users get 0 credits, can't generate books |
| ChatMessage forwardRef warning | Minor | Console noise only |

