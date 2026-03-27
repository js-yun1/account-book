"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";

interface TransactionDetail {
  id: string;
  entry_date: string;
  effective_date: string;
  description: string;
  tx_type: string;
  source: string;
  created_at: string;
  postings: {
    id: string;
    amount: number;
    accounts: { id: string; name: string; type: string; code: string } | null;
    categories: { id: string; name: string } | null;
  }[];
}

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  async function loadTransaction() {
    const { data } = await supabase
      .from("journal_entries")
      .select(
        `
        id, entry_date, effective_date, description, tx_type, source, created_at,
        postings (
          id, amount,
          accounts:account_id (id, name, type, code),
          categories:category_id (id, name)
        )
      `
      )
      .eq("id", id)
      .single();

    setTx(data as TransactionDetail | null);
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("이 거래를 삭제하시겠습니까? 관련 분개가 모두 삭제됩니다.")) return;
    setDeleting(true);

    const { error } = await supabase.from("journal_entries").delete().eq("id", id);

    if (error) {
      alert("삭제 실패: " + error.message);
      setDeleting(false);
      return;
    }

    router.push("/transactions");
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400">불러오는 중...</div>;
  }

  if (!tx) {
    return <div className="p-8 text-center text-gray-400">거래를 찾을 수 없습니다</div>;
  }

  const typeLabel = tx.tx_type === "expense" ? "지출" : tx.tx_type === "income" ? "수입" : "이체";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">거래 상세</h1>
        <Link href="/transactions" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          &larr; 목록으로
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">유형</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">{typeLabel}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">날짜</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">{tx.entry_date}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500 dark:text-gray-400">설명</span>
            <p className="font-medium text-gray-900 dark:text-gray-100">{tx.description}</p>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <div>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">분개 내역</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 dark:text-gray-400 text-left">
                <th className="pb-2">계정</th>
                <th className="pb-2">품목</th>
                <th className="pb-2 text-right">차변</th>
                <th className="pb-2 text-right">대변</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {tx.postings.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-gray-900 dark:text-gray-100">
                    {p.accounts?.name ?? "-"}
                  </td>
                  <td className="py-2 text-gray-600 dark:text-gray-400">
                    {p.categories?.name ?? "-"}
                  </td>
                  <td className="py-2 text-right text-gray-900 dark:text-gray-100">
                    {p.amount > 0 ? formatKRW(p.amount) : ""}
                  </td>
                  <td className="py-2 text-right text-gray-900 dark:text-gray-100">
                    {p.amount < 0 ? formatKRW(Math.abs(p.amount)) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tx.source !== "system" && tx.source !== "recurring" && (
        <div className="flex gap-3">
          <Link
            href={`/transactions/new?edit=${tx.id}`}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white text-center hover:bg-blue-700 transition-colors"
          >
            수정
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-lg border border-red-300 dark:border-red-800 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      )}
      {(tx.source === "system" || tx.source === "recurring") && (
        <p className="text-xs text-center text-gray-400">시스템 자동 생성 분개는 수정/삭제할 수 없습니다</p>
      )}
    </div>
  );
}
