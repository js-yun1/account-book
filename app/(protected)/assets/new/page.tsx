"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import type { Account } from "@/lib/accounting/types";

export default function NewAssetPage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [acquisitionCost, setAcquisitionCost] = useState(0);
  const [residualValue, setResidualValue] = useState(0);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState(60); // 기본 5년
  const [acquisitionDate, setAcquisitionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("type", "asset")
      .eq("subtype", "non_current")
      .eq("is_active", true);
    setAccounts((data as Account[]) || []);
    if (data && data.length > 0) setAccountId(data[0].id);
  }

  const depreciableAmount = acquisitionCost - residualValue;
  const monthlyDep =
    usefulLifeMonths > 0 ? Math.floor(depreciableAmount / usefulLifeMonths) : 0;

  async function handleSubmit() {
    if (!name || !acquisitionCost || !usefulLifeMonths || !accountId) {
      setError("모든 필수 항목을 입력하세요");
      return;
    }
    if (residualValue >= acquisitionCost) {
      setError("잔존가액은 취득가보다 작아야 합니다");
      return;
    }

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("assets").insert({
      user_id: user.id,
      account_id: accountId,
      name,
      acquisition_cost: acquisitionCost,
      residual_value: residualValue,
      useful_life_months: usefulLifeMonths,
      acquisition_date: acquisitionDate,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/assets");
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        자산 등록
      </h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            자산명
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: LG 울트라기어 모니터"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              취득가
            </label>
            <input
              type="number"
              value={acquisitionCost || ""}
              onChange={(e) => setAcquisitionCost(parseInt(e.target.value) || 0)}
              placeholder="원"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              잔존가액 (선택)
            </label>
            <input
              type="number"
              value={residualValue || ""}
              onChange={(e) => setResidualValue(parseInt(e.target.value) || 0)}
              placeholder="기본 0원"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              내용연수 (개월)
            </label>
            <input
              type="number"
              value={usefulLifeMonths || ""}
              onChange={(e) => setUsefulLifeMonths(parseInt(e.target.value) || 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              취득일
            </label>
            <input
              type="date"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {depreciableAmount > 0 && usefulLifeMonths > 0 && (
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 text-sm space-y-1">
            <p className="text-gray-700 dark:text-gray-300">
              감가상각 대상: {formatKRW(depreciableAmount)}
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              월 감가상각비: {formatKRW(monthlyDep)}
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              정액법 · 마지막 월에 잔여액 조정
            </p>
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
          {loading ? "등록 중..." : "자산 등록"}
        </button>
      </div>
    </div>
  );
}
