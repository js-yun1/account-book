"use client";

interface MonthSelectorProps {
  value: string; // "YYYY-MM"
  onChange: (month: string) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const [year, month] = value.split("-").map(Number);

  function prev() {
    const d = new Date(year, month - 2, 1);
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  function next() {
    const d = new Date(year, month, 1);
    const now = new Date();
    if (d > now) return;
    onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const isCurrentMonth = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  return (
    <div className="flex items-center gap-3">
      <button onClick={prev} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[100px] text-center">
        {year}년 {month}월
      </span>
      <button onClick={next} disabled={isCurrentMonth}
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${isCurrentMonth ? "text-gray-300 dark:text-gray-700" : "text-gray-500"}`}>
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  );
}
