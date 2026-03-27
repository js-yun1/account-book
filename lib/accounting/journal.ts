import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TransactionInput,
  ExpenseInput,
  IncomeInput,
  TransferInput,
} from "./types";

interface PostingParam {
  account_id: string;
  category_id?: string;
  amount: number;
}

/**
 * 사용자 입력을 복식부기 분개로 변환하여 DB에 저장한다.
 *
 * 지출: Dr. 비용계정(들) / Cr. 결제수단연결계정
 * 수입: Dr. 입금계정 / Cr. 수입계정
 * 이체: Dr. 입금계정 / Cr. 출금계정
 */
export async function createTransaction(
  supabase: SupabaseClient,
  userId: string,
  input: TransactionInput
): Promise<string> {
  const postings = await buildPostings(supabase, input);
  const total = postings.reduce((sum, p) => sum + p.amount, 0);
  if (total !== 0) {
    throw new Error(`Postings not balanced: total = ${total}`);
  }

  const { data, error } = await supabase.rpc("create_journal_entry", {
    p_user_id: userId,
    p_entry_date: input.date,
    p_effective_date: input.date,
    p_description: input.description,
    p_source: "manual",
    p_tx_type: input.type,
    p_postings: postings,
  });

  if (error) throw error;
  return data as string;
}

async function buildPostings(
  supabase: SupabaseClient,
  input: TransactionInput
): Promise<PostingParam[]> {
  switch (input.type) {
    case "expense":
      return buildExpensePostings(supabase, input);
    case "income":
      return buildIncomePostings(input);
    case "transfer":
      return buildTransferPostings(input);
  }
}

async function buildExpensePostings(
  supabase: SupabaseClient,
  input: ExpenseInput
): Promise<PostingParam[]> {
  // 결제 수단의 연결 계정을 조회
  const { data: pm, error } = await supabase
    .from("payment_methods")
    .select("linked_account_id")
    .eq("id", input.payment_method_id)
    .single();

  if (error || !pm) throw new Error("결제 수단을 찾을 수 없습니다");

  const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);
  const postings: PostingParam[] = [];

  // 차변: 각 비용 계정
  for (const item of input.items) {
    postings.push({
      account_id: item.account_id,
      category_id: item.category_id,
      amount: item.amount, // 양수 = 차변
    });
  }

  // 대변: 결제수단 연결 계정
  postings.push({
    account_id: pm.linked_account_id,
    amount: -totalAmount, // 음수 = 대변
  });

  return postings;
}

function buildIncomePostings(input: IncomeInput): PostingParam[] {
  return [
    // 차변: 입금 계정 (자산 증가)
    { account_id: input.deposit_account_id, amount: input.amount },
    // 대변: 수입 계정
    { account_id: input.income_account_id, amount: -input.amount },
  ];
}

function buildTransferPostings(input: TransferInput): PostingParam[] {
  return [
    // 차변: 입금 계정
    { account_id: input.to_account_id, amount: input.amount },
    // 대변: 출금 계정
    { account_id: input.from_account_id, amount: -input.amount },
  ];
}
