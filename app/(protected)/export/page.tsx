"use client";

import { useState } from "react";

export default function ExportPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleExport() {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    window.open(`/api/export/csv?${params.toString()}`);
  }

  const inputClass =
    "rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        데이터 내보내기
      </h1>

      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          거래 내역을 CSV 파일로 다운로드합니다. 기간을 비워두면 전체 데이터를 내보냅니다.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass + " w-full"} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass + " w-full"} />
          </div>
        </div>

        <button
          onClick={handleExport}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          CSV 다운로드
        </button>
      </div>
    </div>
  );
}
