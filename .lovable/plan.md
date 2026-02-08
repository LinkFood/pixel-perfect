

# PhotoRabbit: Complete Build-Out Plan

This plan combines two major initiatives: (A) fixing existing bugs from the recent code push, and (B) implementing the credit-based monetization system with authentication, Stripe, and watermarking.

## Task List (in order)

### Phase 1: Fix Existing Bugs

**Task 1: Add missing database columns**
- Add `product_type` (text, default 'storybook') to `projects` table
- Add `photo_context_brief` (text, nullable) to `projects` table
- Add `ai_analysis` (jsonb, nullable) to `project_photos` table
- Without these, ProjectContext.tsx and useProject.ts will error at runtime

**Task 2: Fix Badge forwardRef warning**
- Wrap the `Badge` component in `React.forwardRef` so Radix UI tooltip/popover wrappers don't throw console warnings when used with `ProjectStatusBadge`

**Task 3: Update landing page copy for generalized platform**
- `WhatMakesUsDifferent.tsx`: Change "your dog's name" to "your subject's name"
- `Testimonials.tsx`: Replace 1-2 pet-only testimonials with non-pet use cases (birthday book for a child, friend group roast book)
- `Footer.tsx`: Soften "pet owner" to broader language while keeping the Link origin story authentic

**Task 4: Delete unused NavLink component**
- Remove `src/components/NavLink.tsx` (imported nowhere)

### Phase 2: Authentication

**Task 5: Add login/signup page**
- Create `/auth` page with email + password signup and login flows
- Use Lovable Cloud auth (supabase.auth)
- Redirect authenticated users to `/dashboard`
- Redirect unauthenticated users from protected routes to `/auth`

**Task 6: Add `user_id` to projects table**
- Add `user_id` (uuid, nullable initially for migration) to `projects`
- Update RLS policies on all tables to scope data by `auth.uid()`
- Update `useCreateProject` and `useCreateMinimalProject` to set `user_id`
- Filter dashboard to show only the current user's projects

### Phase 3: Credit System Database

**Task 7: Create credit tables**
- `user_credits` table: `id`, `user_id` (uuid, unique), `balance` (integer, default 3 for the free starter credits), `created_at`, `updated_at`
- `credit_transactions` table: `id`, `user_id`, `amount` (integer), `description` (text), `project_id` (uuid, nullable), `stripe_session_id` (text, nullable), `created_at`
- RLS policies scoped to `auth.uid()`
- Database function `deduct_credit(p_user_id uuid, p_project_id uuid, p_description text)` that atomically checks balance >= 1, deducts, logs transaction, and returns new balance (or raises error)
- Trigger: on auth.users insert, auto-create a `user_credits` row with balance = 3

### Phase 4: Stripe Integration

**Task 8: Enable Stripe**
- Use the Lovable Stripe tool to enable Stripe and collect the secret key
- Create three Stripe products/prices for credit packs:
  - Starter: 15 credits / $4.99
  - Standard: 40 credits / $9.99
  - Pro: 100 credits / $19.99

**Task 9: Create `create-checkout` edge function**
- Accepts `{ packId: "starter" | "standard" | "pro" }`
- Validates auth token
- Creates a Stripe Checkout session with the correct price
- Returns the checkout URL

**Task 10: Create `stripe-webhook` edge function**
- Listens for `checkout.session.completed`
- Looks up the credit pack from the session metadata
- Credits the user's balance in `user_credits`
- Logs the transaction in `credit_transactions`

### Phase 5: Credit Enforcement

**Task 11: Update `generate-illustration` edge function**
- Before generating, extract user from auth token
- Call `deduct_credit()` database function
- If insufficient credits, return `{ error: "insufficient_credits", balance: 0 }` with status 402
- On success, proceed with generation as before

**Task 12: Frontend credit UI**
- Add credit balance display in Navbar (small coin icon + number)
- "Buy Credits" button that opens a modal with the three packs
- On ProjectGenerating page: check balance before starting illustration loop; if insufficient, show purchase prompt
- On ProjectReview page: "Regenerate" and "Try Another" buttons check balance; show toast with "Buy more credits" link if insufficient

### Phase 6: Watermark Protection

**Task 13: Create `WatermarkedImage` component**
- CSS-only overlay: semi-transparent "PhotoRabbit" text diagonally across illustration previews
- Used in ProjectGenerating thumbnails, ProjectReview spread viewer, and BookPreview
- No server-side image processing needed

**Task 14: Update PDF download to use unwatermarked images**
- `generatePdf.ts` already fetches raw storage URLs, so this should work as-is
- Add a check: PDF download only available when all pages have illustrations
- The watermark is browser-only (CSS), so PDFs are automatically clean

### Phase 7: Pricing Page Update

**Task 15: Replace fixed-price tiers with credit pack pricing**
- Update `Pricing.tsx` from the current Photo Memory Book / Storybook / Bundle model to the three credit packs
- Add "3 free credits to start" callout
- Each pack shows per-credit price and typical usage ("enough for one book with tweaking")
- "Get Started" buttons link to `/auth` (or trigger checkout if logged in)

---

## Technical Details

### Database Migrations (Tasks 1, 6, 7)

**Migration 1 -- Missing columns:**
```sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'storybook',
  ADD COLUMN IF NOT EXISTS photo_context_brief text;

ALTER TABLE public.project_photos
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;
```

**Migration 2 -- User ownership:**
```sql
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS user_id uuid;
```

**Migration 3 -- Credit system:**
```sql
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  description text NOT NULL,
  project_id uuid,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Atomic deduct function
CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id uuid,
  p_project_id uuid,
  p_description text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  SELECT balance INTO v_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE user_credits
  SET balance = balance - 1, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, description, project_id)
  VALUES (p_user_id, -1, p_description, p_project_id);

  RETURN v_balance - 1;
END;
$$;
```

RLS policies for credit tables will use `auth.uid() = user_id` for SELECT, and only the `deduct_credit` function (SECURITY DEFINER) handles writes.

### Edge Function Changes

**`generate-illustration/index.ts`** -- add credit check before generation:
1. Extract auth header, validate with `getClaims()`
2. Call `supabase.rpc('deduct_credit', { p_user_id, p_project_id, p_description })`
3. If error contains "insufficient_credits", return 402
4. Otherwise proceed with existing generation logic

**New: `create-checkout/index.ts`** -- Stripe checkout session creation
**New: `stripe-webhook/index.ts`** -- Stripe webhook handler (public endpoint, signature validation)

### Frontend Components

**New: `src/pages/Auth.tsx`** -- Login/signup page
**New: `src/components/project/WatermarkedImage.tsx`** -- CSS watermark overlay
**New: `src/components/CreditBalance.tsx`** -- Navbar credit display
**New: `src/components/BuyCreditsModal.tsx`** -- Credit pack purchase modal
**Modified: `src/components/landing/Navbar.tsx`** -- Add credit balance for logged-in users, login/logout button
**Modified: `src/pages/ProjectReview.tsx`** -- Credit check on regenerate/try-another
**Modified: `src/pages/ProjectGenerating.tsx`** -- Credit check before illustration loop
**Modified: `src/components/landing/Pricing.tsx`** -- Credit pack tiers

### Implementation Order

Tasks will be done sequentially (1 through 15) since later tasks depend on earlier ones. Database migrations come first, then auth, then credits, then Stripe, then UI.

