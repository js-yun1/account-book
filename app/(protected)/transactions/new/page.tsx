"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  Category,
  PaymentMethod,
  TransactionInput,
  ExpenseLineItem,
} from "@/lib/accounting/types";
import { formatKRW } from "@/lib/utils/currency";

type Tab = "expense" | "income" | "transfer";

export default function NewTransactionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("expense");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 공통 필드
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");

  // 지출 필드
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [items, setItems] = useState<ExpenseLineItem[]>([
    { description: "", amount: 0, account_id: "", category_id: "" },
  ]);

  // 수입 필드
  const [depositAccountId, setDepositAccountId] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [amount, setAmount] = useState(0);

  // 이체 필드
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [accountsRes, categoriesRes, pmRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("is_active", true).order("code"),
      supabase.from("categories").select("*").eq("is_active", true).order("name"),
      supabase.from("payment_methods").select("*").eq("is_active", true),
    ]);

    if (accountsRes.data) setAccounts(accountsRes.data);
    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (pmRes.data) {
      setPaymentMethods(pmRes.data);
      const defaultPm = pmRes.data.find((pm) => pm.is_default);
      if (defaultPm) setPaymentMethodId(defaultPm.id);
    }
  }

  const expenseAccounts = accounts.filter((a) => a.type === "expense" && !a.is_system);
  const incomeAccounts = accounts.filter((a) => a.type === "income" && !a.is_system);
  const assetAccounts = accounts.filter((a) => a.type === "asset" && !a.is_system);
  const allTransferableAccounts = accounts.filter(
    (a) => (a.type === "asset" || a.type === "liability") && !a.is_system
  );

  function addItem() {
    setItems([...items, { description: "", amount: 0, account_id: "", category_id: "" }]);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ExpenseLineItem, value: string | number) {
    setItems(items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  const totalExpense = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    let input: TransactionInput;

    if (tab === "expense") {
      if (!paymentMethodId) { setError("결제 수단을 선택하세요"); setLoading(false); return; }
      if (items.some((i) => !i.account_id || !i.amount)) { setError("모든 항목의 계정과 금액을 입력하세요"); setLoading(false); return; }
      input = {
        type: "expense",
        date,
        description: description || items.map((i) => i.description).filter(Boolean).join(", "),
        payment_method_id: paymentMethodId,
        items: items.map((i) => ({
          ...i,
          category_id: i.category_id || undefined,
        })),
      };
    } else if (tab === "income") {
      if (!depositAccountId || !incomeAccountId || !amount) { setError("모든 필드를 입력하세요"); setLoading(false); return; }
      input = {
        type: "income",
        date,
        description,
        deposit_account_id: depositAccountId,
        income_account_id: incomeAccountId,
        amount,
      };
    } else {
      if (!fromAccountId || !toAccountId || !transferAmount) { setError("모든 필드를 입력하세요"); setLoading(false); return; }
      if (fromAccountId === toAccountId) { setError("출금 계정과 입금 계정이 같습니다"); setLoading(false); return; }
      input = {
        type: "transfer",
        date,
        description,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: transferAmount,
      };
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장 실패");
      }

      router.push("/transactions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? "bg-blue-600 text-white"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const selectClass = inputClass;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        거래 입력
      </h1>

      {/* 탭 */}
      <div className="flex gap-2">
        <button onClick={() => setTab("expense")} className={tabClass("expense")}>지출</button>
        <button onClick={() => setTab("income")} className={tabClass("income")}>수입</button>
        <button onClick={() => setTab("transfer")} className={tabClass("transfer")}>이체</button>
      </div>

      {/* 공통: 날짜 + 설명 */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">설명</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="거래 설명" className={inputClass} />
          </div>
        </div>

        {/* 지출 탭 */}
        {tab === "expense" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">결제 수단</label>
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)} className={selectClass}>
                <option value="">선택</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>{pm.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">항목</label>
                <button onClick={addItem} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">+ 항목 추가</button>
              </div>

              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <input type="text" placeholder="품목명" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <input type="number" placeholder="금액" value={item.amount || ""} onChange={(e) => updateItem(i, "amount", parseInt(e.target.value) || 0)} className={inputClass} />
                  </div>
                  <div>
                    <select value={item.account_id} onChange={(e) => updateItem(i, "account_id", e.target.value)} className={selectClass}>
                      <option value="">목적</option>
                      {expenseAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select value={item.category_id || ""} onChange={(e) => updateItem(i, "category_id", e.target.value)} className={selectClass}>
                      <option value="">품목</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => removeItem(i)} className="p-2 text-gray-400 hover:text-red-500" disabled={items.length <= 1}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              <div className="text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                합계: {formatKRW(totalExpense)}
              </div>
            </div>
          </div>
        )}

        {/* 수입 탭 */}
        {tab === "income" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입금 계정</label>
                <select value={depositAccountId} onChange={(e) => setDepositAccountId(e.target.value)} className={selectClass}>
                  <option value="">선택</option>
                  {assetAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">수입 목적</label>
                <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} className={selectClass}>
                  <option value="">선택</option>
                  {incomeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">금액</label>
              <input type="number" value={amount || ""} onChange={(e) => setAmount(parseInt(e.target.value) || 0)} placeholder="금액" className={inputClass} />
            </div>
          </div>
        )}

        {/* 이체 탭 */}
        {tab === "transfer" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">출금 계정</label>
                <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} className={selectClass}>
                  <option value="">선택</option>
                  {allTransferableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type === "asset" ? "자산" : "부채"})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">입금 계정</label>
                <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={selectClass}>
                  <option value="">선택</option>
                  {allTransferableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.type === "asset" ? "자산" : "부채"})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">금액</label>
              <input type="number" value={transferAmount || ""} onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)} placeholder="금액" className={inputClass} />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
