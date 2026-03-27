"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatKRW } from "@/lib/utils/currency";

interface NetWorthDataPoint {
  month: string;
  netWorth: number;
}

interface NetWorthChartProps {
  data: NetWorthDataPoint[];
}

export function NetWorthChart({ data }: NetWorthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-600">
        데이터가 쌓이면 순자산 변화를 보여줍니다
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
        />
        <Tooltip
          formatter={(value) => formatKRW(Number(value))}
          labelFormatter={(label) => `${label}`}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="순자산"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
