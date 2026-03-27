// === 계정 ===

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountSubtype = "current" | "non_current" | null;

export interface Account {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype;
  parent_id: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

// === 카테고리 (품목) ===

export interface Category {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

// === 결제 수단 ===

export type PaymentMethodType = "cash" | "bank_account" | "credit_card" | "debit_card";

export interface PaymentMethod {
  id: string;
  user_id: string;
  name: string;
  method_type: PaymentMethodType;
  linked_account_id: string;
  settlement_day: number | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

// === 분개 ===

export type JournalSource = "manual" | "receipt_ai" | "recurring" | "system";
export type TransactionType = "income" | "expense" | "transfer";

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  effective_date: string;
  description: string;
  reference: string | null;
  receipt_image_path: string | null;
  source: JournalSource;
  tx_type: TransactionType;
  created_at: string;
  updated_at: string;
}

export interface Posting {
  id: string;
  journal_entry_id: string;
  account_id: string;
  category_id: string | null;
  amount: number; // 양수=차변, 음수=대변
  created_at: string;
}

// === 거래 입력 (사용자 → 복식부기 변환 전) ===

export interface ExpenseLineItem {
  description: string;
  amount: number;
  account_id: string;     // 목적 계정 (비용)
  category_id?: string;   // 품목 카테고리
}

export interface ExpenseInput {
  type: "expense";
  date: string;
  description: string;
  payment_method_id: string;
  items: ExpenseLineItem[];
}

export interface IncomeInput {
  type: "income";
  date: string;
  description: string;
  deposit_account_id: string; // 입금할 자산 계정
  income_account_id: string;  // 수입 목적 계정
  amount: number;
}

export interface TransferInput {
  type: "transfer";
  date: string;
  description: string;
  from_account_id: string; // 출금 계정
  to_account_id: string;   // 입금 계정
  amount: number;
}

export type TransactionInput = ExpenseInput | IncomeInput | TransferInput;

// === 계정 잔액 ===

export interface AccountBalance {
  account_id: string;
  account_name: string;
  account_type: AccountType;
  balance: number;
}

// === 사용자 설정 ===

export interface UserSettings {
  id: string;
  user_id: string;
  materiality_threshold: number;
  monthly_income: number | null;
  monthly_expense: number | null;
  ai_api_provider: "anthropic" | "openai" | null;
  ai_api_key_encrypted: string | null;
  forecast_months: 6 | 12;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
