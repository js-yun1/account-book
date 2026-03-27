"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Account, PaymentMethod } from "@/lib/accounting/types";

export default function NewRecurringPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [flowType, setFlowType] = useState("fixed_recurring");
  const [txType, setTxType] = useState("expense");
  const [amount, setAmount] = useState(0);
  const [accountId, setAccountId] = useState(""); // 목적 계정 (비용/수입)
  const [paymentMethodId, setPaymentMethodId] = useState(""); // 지출 시 결제수단
  const [depositAccountId, setDepositAccountId] = useState(""); // 수입 시 입금 계정
  const [isPrepaid, setIsPrepaid] = useState(false);
  const [allocationMonths, setAllocationMonths] = useState(12);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [accountsRes, pmRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true).order("code"),
      supabase.from("payment_methods").select("*").eq("is_active", true),
    ]);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (pmRes.data) setPaymentMethods(pmRes.data);
  }

  const expenseAccounts = accounts.filter((a) => a.type === "expense" && !a.is_system);
  const incomeAccounts = accounts.filter((a) => a.type === "income" && !a.is_system);
  const assetAccounts = accounts.filter((a) => a.type === "asset" && !a.is_system);

  async function handleSubmit() {
    if (!name || !amount || !accountId) {
      setError("모든 필수 항목을 입력하세요");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("로그인 필요"); setLoading(false); return; }

    // 분개 템플릿 생성
    let postingsTemplate;
    if (txType === "expense") {
      if (!paymentMethodId) { setError("결제 수단을 선택하세요"); setLoading(false); return; }
      const pm = paymentMethods.find((p) => p.id === paymentMethodId);
      postingsTemplate = [
        { account_id: accountId, amount },
        { account_id: pm?.linked_account_id, amount: -amount },
      ];
    } else if (txType === "income") {
      if (!depositAccountId) { setError("입금 계정을 선택하세요"); setLoading(false); return; }
      postingsTemplate = [
        { account_id: depositAccountId, amount },
        { account_id: accountId, amount: -amount },
      ];
    } else {
      // transfer: accountId = from, depositAccountId = to
      if (!depositAccountId) { setError("입금 계정을 선택하세요"); setLoading(false); return; }
      postingsTemplate = [
        { account_id: depositAccountId, amount },
        { account_id: accountId, amount: -amount },
      ];
    }

    const { error: insertError } = await supabase.from("recurring_rules").insert({
      user_id: user.id,
      name,
      frequency,
      day_of_month: dayOfMonth,
      start_date: new Date().toISOString().split("T")[0],
      postings_template: postingsTemplate,
      flow_type: flowType,
      tx_type: txType,
      is_prepaid: isPrepaid,
      allocation_months: isPrepaid ? allocationMonths : null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/recurring");
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        반복 거래 등록
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 월세, 넷플릭스" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">유형</label>
            <select value={flowType} onChange={(e) => setFlowType(e.target.value)} className={inputClass}>
              <option value="fixed_recurring">고정 반복</option>
              <option value="scheduled_nonrecurring">예정 비반복</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">거래 유형</label>
            <select value={txType} onChange={(e) => setTxType(e.target.value)} className={inputClass}>
              <option value="expense">지출</option>
              <option value="income">수입</option>
              <option value="transfer">이체</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">주기</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className={inputClass}>
              <option value="monthly">매월</option>
              <option value="quarterly">매분기</option>
              <option value="annually">매년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">실행일</label>
            <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">금액</label>
          <input type="number" value={amount || ""} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {txType === "expense" ? "목적 계정" : txType === "income" ? "수입 목적" : "출금 계정"}
          </label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
            <option value="">선택</option>
            {(txType === "expense" ? expenseAccounts : txType === "income" ? incomeAccounts : accounts.filter((a) => a.type === "asset" || a.type === "liability")).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        {txType === "expense" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">결제 수단</label>
            <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={inputClass}>
              <option value="">선택</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}</option>
              ))}
            </select>
          </div>
        )}

        {(txType === "income" || txType === "transfer") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입금 계정</label>
            <select value={depositAccountId} onChange={(e) => setDepositAccountId(e.target.value)} className={inputClass}>
              <option value="">선택</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="prepaid" checked={isPrepaid} onChange={(e) => setIsPrepaid(e.target.checked)} className="rounded" />
          <label htmlFor="prepaid" className="text-sm text-gray-700 dark:text-gray-300">선불비용 (월할 배분)</label>
          {isPrepaid && (
            <input type="number" value={allocationMonths} onChange={(e) => setAllocationMonths(parseInt(e.target.value) || 12)} className={inputClass + " w-20 ml-2"} placeholder="개월" />
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "등록 중..." : "등록"}
        </button>
      </div>
    </div>
  );
}
