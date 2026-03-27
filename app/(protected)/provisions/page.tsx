"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";

interface Provision {
  id: string;
  name: string;
  monthly_accrual: number;
  is_active: boolean;
  created_at: string;
  provision_account_id: string;
}

export default function ProvisionsPage() {
  const supabase = createClient();
  const [provisions, setProvisions] = useState<Provision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProvisions();
  }, []);

  async function loadProvisions() {
    const { data } = await supabase
      .from("provisions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setProvisions((data as Provision[]) || []);
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 준비금을 삭제하시겠습니까?")) return;
    await supabase.from("provisions").update({ is_active: false }).eq("id", id);
    setProvisions(provisions.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          준비금 관리
        </h1>
        <Link
          href="/provisions/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + 준비금 생성
        </Link>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        발생 시점은 모르지만 반드시 발생할 지출에 대비하는 가상 적립금입니다.
        적립액은 현금흐름 예측에 지출로 반영됩니다.
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : provisions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            등록된 준비금이 없습니다
          </div>
        ) : (
          provisions.map((prov) => (
            <div key={prov.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {prov.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  월 {formatKRW(prov.monthly_accrual)} 적립
                </p>
              </div>
              <button
                onClick={() => handleDelete(prov.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                비활성화
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
