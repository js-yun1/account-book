-- ============================================================
-- Account Book: Recurring Rules + Provisions
-- ============================================================

-- 반복/예정 거래 규칙
CREATE TABLE recurring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annually', 'custom')),
  day_of_month INT CHECK (day_of_month >= 1 AND day_of_month <= 31),
  start_date DATE NOT NULL,
  end_date DATE,
  postings_template JSONB NOT NULL,
  flow_type VARCHAR(30) NOT NULL CHECK (flow_type IN ('fixed_recurring', 'scheduled_nonrecurring')),
  tx_type VARCHAR(20) NOT NULL CHECK (tx_type IN ('income', 'expense', 'transfer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_prepaid BOOLEAN NOT NULL DEFAULT false,
  allocation_months INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_rules_user ON recurring_rules(user_id);

ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring_rules"
  ON recurring_rules FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own recurring_rules"
  ON recurring_rules FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own recurring_rules"
  ON recurring_rules FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own recurring_rules"
  ON recurring_rules FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 준비금 계정
CREATE TABLE provisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  provision_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  monthly_accrual BIGINT NOT NULL CHECK (monthly_accrual > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provisions_user ON provisions(user_id);

ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own provisions"
  ON provisions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own provisions"
  ON provisions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own provisions"
  ON provisions FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own provisions"
  ON provisions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
