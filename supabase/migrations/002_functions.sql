-- ============================================================
-- Account Book: RPC Functions
-- ============================================================

-- 분개 생성 (차대변 균형 검증 포함)
CREATE OR REPLACE FUNCTION create_journal_entry(
  p_user_id UUID,
  p_entry_date DATE,
  p_effective_date DATE,
  p_description TEXT,
  p_source TEXT,
  p_tx_type TEXT,
  p_postings JSONB  -- [{account_id, category_id?, amount}, ...]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journal_id UUID;
  v_total BIGINT;
  v_posting JSONB;
BEGIN
  -- 차대변 균형 검증
  SELECT SUM((p->>'amount')::BIGINT)
  INTO v_total
  FROM jsonb_array_elements(p_postings) AS p;

  IF v_total != 0 THEN
    RAISE EXCEPTION 'Journal entry not balanced: total = %', v_total;
  END IF;

  -- 분개 헤더 생성
  INSERT INTO journal_entries (user_id, entry_date, effective_date, description, source, tx_type)
  VALUES (p_user_id, p_entry_date, p_effective_date, p_description, p_source, p_tx_type)
  RETURNING id INTO v_journal_id;

  -- Posting 라인 생성
  FOR v_posting IN SELECT * FROM jsonb_array_elements(p_postings)
  LOOP
    INSERT INTO postings (journal_entry_id, account_id, category_id, amount)
    VALUES (
      v_journal_id,
      (v_posting->>'account_id')::UUID,
      CASE WHEN v_posting->>'category_id' IS NOT NULL
        THEN (v_posting->>'category_id')::UUID
        ELSE NULL
      END,
      (v_posting->>'amount')::BIGINT
    );
  END LOOP;

  RETURN v_journal_id;
END;
$$;

-- 계정 잔액 조회 (특정 날짜 기준)
CREATE OR REPLACE FUNCTION get_account_balance(
  p_account_id UUID,
  p_as_of DATE DEFAULT CURRENT_DATE
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(p.amount), 0)::BIGINT
  FROM postings p
  JOIN journal_entries je ON p.journal_entry_id = je.id
  WHERE p.account_id = p_account_id
    AND je.effective_date <= p_as_of;
$$;

-- 특정 사용자의 모든 계정 잔액 조회
CREATE OR REPLACE FUNCTION get_all_account_balances(
  p_user_id UUID,
  p_as_of DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(account_id UUID, account_name VARCHAR, account_type VARCHAR, balance BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    COALESCE(SUM(p.amount), 0)::BIGINT AS balance
  FROM accounts a
  LEFT JOIN postings p ON a.id = p.account_id
  LEFT JOIN journal_entries je ON p.journal_entry_id = je.id AND je.effective_date <= p_as_of
  WHERE a.user_id = p_user_id AND a.is_active = true
  GROUP BY a.id, a.name, a.type
  ORDER BY a.code;
$$;

-- 기본 계정과목 시드 (신규 사용자 온보딩 시 호출)
CREATE OR REPLACE FUNCTION seed_default_accounts(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- === 자산 계정 ===
  INSERT INTO accounts (user_id, code, name, type, subtype, is_system) VALUES
    (p_user_id, '1000', '자산', 'asset', 'current', true),
    (p_user_id, '1100', '현금', 'asset', 'current', true),
    (p_user_id, '1200', '선불비용', 'asset', 'current', true),
    (p_user_id, '1900', '비유동자산', 'asset', 'non_current', true);

  -- === 부채 계정 ===
  INSERT INTO accounts (user_id, code, name, type, is_system) VALUES
    (p_user_id, '2000', '부채', 'liability', true);

  -- === 수입 계정 (목적별) ===
  INSERT INTO accounts (user_id, code, name, type, is_system) VALUES
    (p_user_id, '4000', '수입', 'income', true),
    (p_user_id, '4100', '근로소득', 'income', false),
    (p_user_id, '4200', '부수입', 'income', false),
    (p_user_id, '4300', '투자수익', 'income', false);

  -- === 지출 계정 (목적별) ===
  INSERT INTO accounts (user_id, code, name, type, is_system) VALUES
    (p_user_id, '5000', '지출', 'expense', true),
    (p_user_id, '5100', '요리', 'expense', false),
    (p_user_id, '5200', '외식', 'expense', false),
    (p_user_id, '5300', '주거', 'expense', false),
    (p_user_id, '5400', '교통', 'expense', false),
    (p_user_id, '5500', '건강', 'expense', false),
    (p_user_id, '5600', '여가', 'expense', false),
    (p_user_id, '5700', '쇼핑', 'expense', false),
    (p_user_id, '5800', '교육', 'expense', false),
    (p_user_id, '5900', '경조사', 'expense', false),
    (p_user_id, '5950', '통신', 'expense', false),
    (p_user_id, '5960', '보험', 'expense', false),
    (p_user_id, '5970', '세금', 'expense', false),
    (p_user_id, '5980', '기타', 'expense', false),
    (p_user_id, '5990', '감가상각비', 'expense', true);

  -- === 기본 카테고리 (품목) ===
  INSERT INTO categories (user_id, name) VALUES
    (p_user_id, '식료품'),
    (p_user_id, '생활용품'),
    (p_user_id, '의류'),
    (p_user_id, '전자제품'),
    (p_user_id, '가구/인테리어'),
    (p_user_id, '의료/약품'),
    (p_user_id, '교육/도서'),
    (p_user_id, '문화/여가'),
    (p_user_id, '교통/주유'),
    (p_user_id, '공과금'),
    (p_user_id, '기타');

  -- === 기본 설정 ===
  INSERT INTO user_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;
