import React from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

export interface ContactReportChartItem {
  name: string;
  value: number;
  color: string;
}

export interface ContactReportChartsProps {
  chartData: ContactReportChartItem[];
}

export function ContactReportCharts({ chartData }: ContactReportChartsProps): React.JSX.Element {
  return (
    <PieChart>
      <Pie
        data={chartData}
        cx="50%"
        cy="50%"
        innerRadius={50}
        outerRadius={80}
        paddingAngle={4}
        dataKey="value"
      >
        {chartData.map((entry) => (
          <Cell key={entry.name} fill={entry.color} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          backgroundColor: "var(--card)",
          borderColor: "var(--border)",
          borderRadius: "0.75rem",
          color: "var(--foreground)",
        }}
      />
    </PieChart>
  );
}

export default ContactReportCharts;
