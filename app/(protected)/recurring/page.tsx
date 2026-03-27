"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";

interface RecurringRule {
  id: string;
  name: string;
  frequency: string;
  day_of_month: number | null;
  flow_type: string;
  tx_type: string;
  is_prepaid: boolean;
  allocation_months: number | null;
  is_active: boolean;
  postings_template: { amount: number }[];
}

const FREQ_LABELS: Record<string, string> = {
  monthly: "매월",
  quarterly: "매분기",
  annually: "매년",
  custom: "사용자 정의",
};

export default function RecurringPage() {
  const supabase = createClient();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    const { data } = await supabase
      .from("recurring_rules")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setRules((data as RecurringRule[]) || []);
    setLoading(false);
  }

  function getAmount(rule: RecurringRule): number {
    return rule.postings_template
      .filter((p) => p.amount > 0)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 반복 거래를 삭제하시겠습니까?")) return;
    await supabase.from("recurring_rules").delete().eq("id", id);
    setRules(rules.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          반복/예정 거래
        </h1>
        <Link
          href="/recurring/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + 등록
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            등록된 반복 거래가 없습니다
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {rule.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {FREQ_LABELS[rule.frequency]}
                  {rule.day_of_month && ` · ${rule.day_of_month}일`}
                  {rule.is_prepaid && ` · 선불비용 (${rule.allocation_months}개월 배분)`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-sm font-semibold ${
                    rule.tx_type === "expense"
                      ? "text-red-600 dark:text-red-400"
                      : rule.tx_type === "income"
                      ? "text-green-600 dark:text-green-400"
                      : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {formatKRW(getAmount(rule))}
                </span>
                <button
                  onClick={() => handleDelete(rule.id)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
