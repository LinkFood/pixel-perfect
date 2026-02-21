-- ============================================
-- Token Economy: Variable cost deductions
-- ============================================

-- Update deduct_credit to accept variable amount (default 1 for backwards compat)
CREATE OR REPLACE FUNCTION public.deduct_credit(
  p_user_id uuid,
  p_project_id uuid,
  p_description text,
  p_amount integer DEFAULT 1
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

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE user_credits
  SET balance = balance - p_amount, updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, description, project_id)
  VALUES (p_user_id, -p_amount, p_description, p_project_id);

  RETURN v_balance - p_amount;
END;
$$;

-- Update default balance from 3 to 5 tokens for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 5);
  RETURN NEW;
END;
$$;
