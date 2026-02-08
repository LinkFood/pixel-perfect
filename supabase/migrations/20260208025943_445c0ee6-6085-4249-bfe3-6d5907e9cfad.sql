
-- ============================================
-- Migration 1: Add missing columns to existing tables
-- ============================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'storybook',
  ADD COLUMN IF NOT EXISTS photo_context_brief text,
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.project_photos
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

-- ============================================
-- Migration 2: Credit system tables
-- ============================================
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  description text NOT NULL,
  project_id uuid,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- Migration 3: Atomic deduct_credit function
-- ============================================
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

-- ============================================
-- Migration 4: Auto-create user_credits on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 3);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_credits();

-- ============================================
-- Migration 5: Update RLS on projects to scope by user
-- ============================================
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;
CREATE POLICY "Users can view own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Migration 6: Update RLS on related tables
-- ============================================
DROP POLICY IF EXISTS "Allow all access to project_photos" ON public.project_photos;
CREATE POLICY "Users can manage own project photos"
  ON public.project_photos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_photos.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_photos.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow all access to project_interview" ON public.project_interview;
CREATE POLICY "Users can manage own project interview"
  ON public.project_interview FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_interview.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_interview.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow all access to project_pages" ON public.project_pages;
CREATE POLICY "Users can manage own project pages"
  ON public.project_pages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_pages.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_pages.project_id AND projects.user_id = auth.uid()));

DROP POLICY IF EXISTS "Allow all access to project_illustrations" ON public.project_illustrations;
CREATE POLICY "Users can manage own project illustrations"
  ON public.project_illustrations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_illustrations.project_id AND projects.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = project_illustrations.project_id AND projects.user_id = auth.uid()));

-- ============================================
-- Migration 7: Updated_at trigger for user_credits
-- ============================================
CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
