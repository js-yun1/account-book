"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatKRW } from "@/lib/utils/currency";
import type { MonthlyProjection } from "@/lib/forecast/projection";

interface CashFlowChartProps {
  data: MonthlyProjection[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-600">
        거래를 입력하면 예측 그래프가 표시됩니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => v.slice(5)} // "MM" 만 표시
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
        />
        <Tooltip
          formatter={(value) => formatKRW(Number(value))}
          labelFormatter={(label) => `${label}`}
        />
        <Area
          type="monotone"
          dataKey="cumulativeBalance"
          name="예상 잔액"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
