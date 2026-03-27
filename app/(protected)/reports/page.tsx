import Link from "next/link";

const reports = [
  {
    href: "/reports/income-statement",
    title: "월간 손익",
    description: "이번 달 얼마나 벌고 썼나? (발생주의 비용 기준)",
    icon: "P&L",
  },
  {
    href: "/reports/balance-sheet",
    title: "재산 현황",
    description: "지금 순자산이 얼마인가? (유동/비유동 분리)",
    icon: "B/S",
  },
  {
    href: "/reports/cash-flow",
    title: "현금흐름표",
    description: "실제 돈이 얼마나 오고 갔나?",
    icon: "C/F",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">보고서</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {r.icon}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{r.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
