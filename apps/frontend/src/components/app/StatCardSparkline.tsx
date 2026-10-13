import React from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export interface StatCardSparklineProps {
  data: number[];
}

export const StatCardSparkline = React.memo(function StatCardSparkline({
  data,
}: StatCardSparklineProps): React.JSX.Element | null {
  if (!data || data.length < 2) return null;
  return (
    <div className="w-16 h-8" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.map((v, i) => ({ v, i }))}>
          <Line
            type="monotone"
            dataKey="v"
            dot={false}
            strokeWidth={1.5}
            stroke="hsl(var(--primary))"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
