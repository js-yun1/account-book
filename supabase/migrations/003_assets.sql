-- ============================================================
-- Account Book: Assets (감가상각 대상 자산)
-- ============================================================

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  name VARCHAR(256) NOT NULL,
  acquisition_cost BIGINT NOT NULL CHECK (acquisition_cost > 0),
  residual_value BIGINT NOT NULL DEFAULT 0 CHECK (residual_value >= 0),
  useful_life_months INT NOT NULL CHECK (useful_life_months > 0),
  acquisition_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed')),
  disposed_date DATE,
  disposed_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_assets_status ON assets(user_id, status);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
