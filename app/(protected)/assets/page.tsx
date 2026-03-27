"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatKRW } from "@/lib/utils/currency";
import { getDepreciationAsOf } from "@/lib/accounting/depreciation";

interface AssetRow {
  id: string;
  name: string;
  acquisition_cost: number;
  residual_value: number;
  useful_life_months: number;
  acquisition_date: string;
  status: string;
}

export default function AssetsPage() {
  const supabase = createClient();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    const { data } = await supabase
      .from("assets")
      .select("*")
      .eq("status", "active")
      .order("acquisition_date", { ascending: false });

    setAssets((data as AssetRow[]) || []);
    setLoading(false);
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">자산 관리</h1>
        <Link
          href="/assets/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + 자산 등록
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <div className="p-8 text-center text-gray-400">불러오는 중...</div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            등록된 자산이 없습니다
          </div>
        ) : (
          assets.map((asset) => {
            const dep = getDepreciationAsOf(
              {
                acquisitionCost: asset.acquisition_cost,
                residualValue: asset.residual_value,
                usefulLifeMonths: asset.useful_life_months,
                acquisitionDate: asset.acquisition_date,
              },
              currentMonth
            );

            const progressPercent = Math.round(
              (dep.accumulated / (asset.acquisition_cost - asset.residual_value)) * 100
            );

            return (
              <div key={asset.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {asset.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {asset.acquisition_date} 취득 · 내용연수 {asset.useful_life_months}개월
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatKRW(dep.bookValue)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      취득가 {formatKRW(asset.acquisition_cost)}
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  상각 {progressPercent}% · 월 {formatKRW(dep.monthlyAmount)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
