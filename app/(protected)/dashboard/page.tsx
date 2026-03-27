export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        대시보드
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 수입</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            ₩0
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 달 비용</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            ₩0
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">순자산</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            ₩0
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          미래 현금흐름 예측
        </h2>
        <div className="mt-4 flex items-center justify-center h-64 text-gray-400 dark:text-gray-600">
          거래를 입력하면 예측 그래프가 표시됩니다
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          순자산 추이
        </h2>
        <div className="mt-4 flex items-center justify-center h-48 text-gray-400 dark:text-gray-600">
          데이터가 쌓이면 순자산 변화를 보여줍니다
        </div>
      </div>
    </div>
  );
}
