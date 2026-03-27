"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import type { TransactionType } from "@/lib/accounting/types";

interface TransactionRow {
  id: string;
  entry_date: string;
  description: string;
  tx_type: TransactionType;
  postings: {
    amount: number;
    accounts: { name: string; type: string } | null;
    categories: { name: string } | null;
  }[];
}

const TX_TYPE_LABELS: Record<TransactionType, string> = {
  expense: "지출",
  income: "수입",
  transfer: "이체",
};

const TX_TYPE_COLORS: Record<TransactionType, string> = {
  expense: "text-red-600 dark:text-red-400",
  income: "text-green-600 dark:text-green-400",
  transfer: "text-blue-600 dark:text-blue-400",
};

export default function TransactionsPage() {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TransactionType | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  async function loadTransactions() {
    setLoading(true);
    let query = supabase
      .from("journal_entries")
      .select(
        `
        id, entry_date, description, tx_type,
        postings (
          amount,
          accounts:account_id (name, type),
          categories:category_id (name)
        )
      `
      )
      .order("entry_date", { ascending: false })
      .limit(50);

    if (filter) query = query.eq("tx_type", filter);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data } = await query;
    setTransactions((data as unknown as TransactionRow[]) || []);
    setLoading(false);
  }

  function getDisplayAmount(tx: TransactionRow): { amount: number; label: string } {
    if (tx.tx_type === "expense") {
      const total = tx.postings
        .filter((p) => p.amount > 0)
        .reduce((sum, p) => sum + p.amount, 0);
      return { amount: total, label: `-${formatKRW(total)}` };
    }
    if (tx.tx_type === "income") {
      const total = tx.postings
        .filter((p) => p.amount > 0)
        .reduce((sum, p) => sum + p.amount, 0);
      return { amount: total, label: `+${formatKRW(total)}` };
    }
    // transfer
    const total = tx.postings
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + p.amount, 0);
    return { amount: total, label: formatKRW(total) };
  }

  const inputClass =
    "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">거래 내역</h1>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + 새 거래
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TransactionType | "")}
          className={inputClass}
        >
          <option value="">전체 유형</option>
          <option value="expense">지출</option>
          <option value="income">수입</option>
          <option value="transfer">이체</option>
        </select>
        <input
          type="text"
          placeholder="검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && loadTransactions()}
          className={inputClass + " flex-1 min-w-[200px]"}
        />
      </div>

      {/* 목록 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            거래 내역이 없습니다.{" "}
            <Link href="/transactions/new" className="text-blue-600 dark:text-blue-400 hover:underline">
              첫 거래를 입력해보세요
            </Link>
          </div>
        ) : (
          transactions.map((tx) => {
            const { label } = getDisplayAmount(tx);
            return (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      tx.tx_type === "expense"
                        ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : tx.tx_type === "income"
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    }`}>
                      {TX_TYPE_LABELS[tx.tx_type]}
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {tx.description}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {tx.entry_date}
                  </p>
                </div>
                <span className={`text-sm font-semibold ml-4 shrink-0 ${TX_TYPE_COLORS[tx.tx_type]}`}>
                  {label}
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
