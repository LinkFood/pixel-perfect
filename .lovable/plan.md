

# End-to-End Test Results and Fix Plan

## Critical Bug Found

**Anonymous sign-up is completely broken** -- every new visitor hits a 500 error and the app is non-functional.

### Root Cause
There are **two identical database triggers** on the auth.users table, both trying to insert a row into `user_credits`:

1. `on_auth_user_created_credits` (created in the Feb 8 migration)
2. `on_auth_user_created` (created in the Feb 13 migration)

When a new user signs up, both triggers fire. The second one fails because the `user_id` column has a `UNIQUE` constraint, and the first trigger already inserted the row. This error aborts the entire auth transaction, so the user never gets created.

### Fix
Run a database migration to:
1. Drop the duplicate trigger `on_auth_user_created`
2. Update the function to use `INSERT ... ON CONFLICT DO NOTHING` as a safety net

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 3)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

---

## Minor Issue: CTA Button Partially Below Fold

The "Choose photos to start" button on the hero landing is still slightly clipped at the bottom of a 1080p viewport. Not blocking, but worth a small tweak.

### Fix
In `HeroLanding.tsx`, reduce the bottom padding on the container from `pb-6` to `pb-3`, and reduce the flipbook showcase's vertical space slightly.

---

## What Passed

- **Back button logic**: Correctly sets status to `interview` (not `generating`) -- no false cinematic reveal
- **Early-phase chat**: Authenticated users on home/upload/mood-picker phases now get Rabbit responses
- **Chat message rendering**: Messages render in all phases for both auth'd and unauth'd users
- **Shared book viewer**: Structurally sound with gift reveal, spread navigation, touch swipe, and CTA footer
- **Dev mode tools**: Toolbar with auto-fill, phase skipping, and clear all present
- **Mobile layout**: Collapsible sandbox toggle, stacked layout logic in place
- **Credit gate**: Inline credit check before generation with proper deduction flow
- **Project shelf**: Multi-project switching and deletion logic correct

---

## Technical Summary

| Change | File | Details |
|--------|------|---------|
| Drop duplicate trigger | Database migration | `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users` |
| Make credit insert idempotent | Database migration | Add `ON CONFLICT (user_id) DO NOTHING` to trigger function |
| Tighten hero padding | `src/components/workspace/HeroLanding.tsx` | `pb-6` to `pb-3` on outer container |

