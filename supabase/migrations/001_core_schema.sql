-- ============================================================
-- Account Book: Core Schema
-- 복식부기 기반 가계부 핵심 테이블
-- ============================================================

-- 1) accounts: 계정과목 (목적별 비용/수입 계정 + 자산/부채 계정)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(256) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  subtype VARCHAR(20) CHECK (subtype IN ('current', 'non_current')),
  parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(user_id, type);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 2) categories: 품목별 카테고리 (계층 구조)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user ON categories(user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3) payment_methods: 결제 수단
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(256) NOT NULL,
  method_type VARCHAR(20) NOT NULL CHECK (method_type IN ('cash', 'bank_account', 'credit_card', 'debit_card')),
  linked_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  settlement_day INT CHECK (settlement_day >= 1 AND settlement_day <= 31),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment_methods"
  ON payment_methods FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own payment_methods"
  ON payment_methods FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own payment_methods"
  ON payment_methods FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own payment_methods"
  ON payment_methods FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4) journal_entries: 분개 헤더
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  description VARCHAR(1024) NOT NULL,
  reference VARCHAR(256),
  receipt_image_path TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'receipt_ai', 'recurring', 'system')),
  tx_type VARCHAR(20) NOT NULL CHECK (tx_type IN ('income', 'expense', 'transfer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_user ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(user_id, effective_date);
CREATE INDEX idx_journal_entries_type ON journal_entries(user_id, tx_type);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal_entries"
  ON journal_entries FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own journal_entries"
  ON journal_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own journal_entries"
  ON journal_entries FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own journal_entries"
  ON journal_entries FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 5) postings: 분개 라인 (복식부기 핵심)
CREATE TABLE postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_postings_journal ON postings(journal_entry_id);
CREATE INDEX idx_postings_account ON postings(account_id);
CREATE INDEX idx_postings_account_date ON postings(account_id, created_at);

ALTER TABLE postings ENABLE ROW LEVEL SECURITY;

-- postings는 journal_entry를 통해 간접 보호
CREATE POLICY "Users can view own postings"
  ON postings FOR SELECT TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own postings"
  ON postings FOR INSERT TO authenticated
  WITH CHECK (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own postings"
  ON postings FOR UPDATE TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own postings"
  ON postings FOR DELETE TO authenticated
  USING (
    journal_entry_id IN (
      SELECT id FROM journal_entries WHERE user_id = (SELECT auth.uid())
    )
  );

-- 6) user_settings: 사용자 설정
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  materiality_threshold BIGINT NOT NULL DEFAULT 500000,
  monthly_income BIGINT,
  monthly_expense BIGINT,
  ai_api_provider VARCHAR(20) CHECK (ai_api_provider IN ('anthropic', 'openai')),
  ai_api_key_encrypted TEXT,
  forecast_months INT NOT NULL DEFAULT 6 CHECK (forecast_months IN (6, 12)),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
