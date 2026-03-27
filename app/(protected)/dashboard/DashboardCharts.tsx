"use client";

import { useState } from "react";
import { CashFlowChart } from "@/app/components/charts/CashFlowChart";
import { NetWorthChart } from "@/app/components/charts/NetWorthChart";
import type { MonthlyProjection } from "@/lib/forecast/projection";

export function DashboardCharts() {
  const [forecastMonths, setForecastMonths] = useState<6 | 12>(6);

  // TODO: 실제 데이터 로드 후 예측 엔진 연동
  // 현재는 empty state 표시
  const projections: MonthlyProjection[] = [];
  const netWorthData: { month: string; netWorth: number }[] = [];

  return (
    <>
      {/* 미래 현금흐름 예측 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            미래 현금흐름 예측
          </h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setForecastMonths(6)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                forecastMonths === 6
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              6개월
            </button>
            <button
              onClick={() => setForecastMonths(12)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                forecastMonths === 12
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              12개월
            </button>
          </div>
        </div>
        <CashFlowChart data={projections} />
      </div>

      {/* 순자산 추이 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          순자산 추이
        </h2>
        <NetWorthChart data={netWorthData} />
      </div>
    </>
  );
}
