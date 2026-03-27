"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";

const PROVISION_PRESETS = [
  { name: "부조금 준비금", suggestedAmount: 100000 },
  { name: "의료비 준비금", suggestedAmount: 50000 },
  { name: "긴급 수리비", suggestedAmount: 50000 },
  { name: "비상금", suggestedAmount: 200000 },
];

export default function NewProvisionPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [monthlyAccrual, setMonthlyAccrual] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyPreset(preset: (typeof PROVISION_PRESETS)[0]) {
    setName(preset.name);
    setMonthlyAccrual(preset.suggestedAmount);
  }

  async function handleSubmit() {
    if (!name || !monthlyAccrual) {
      setError("이름과 월 적립액을 입력하세요");
      return;
    }

    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("로그인 필요"); setLoading(false); return; }

    // 준비금 전용 부채 계정 생성
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        code: `2${Date.now().toString().slice(-4)}`,
        name: `${name} (준비금)`,
        type: "liability",
        is_system: true,
      })
      .select()
      .single();

    if (accountError || !account) {
      setError("준비금 계정 생성 실패");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("provisions").insert({
      user_id: user.id,
      name,
      provision_account_id: account.id,
      monthly_accrual: monthlyAccrual,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/provisions");
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        준비금 생성
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            빠른 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {PROVISION_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="rounded-full border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            준비금 이름
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 부조금 준비금" className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            월 적립액
          </label>
          <input type="number" value={monthlyAccrual || ""} onChange={(e) => setMonthlyAccrual(parseInt(e.target.value) || 0)} className={inputClass} />
          {monthlyAccrual > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              연간 {formatKRW(monthlyAccrual * 12)} 적립 (현금흐름 예측에 지출로 반영)
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading} className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? "생성 중..." : "준비금 생성"}
        </button>
      </div>
    </div>
  );
}
