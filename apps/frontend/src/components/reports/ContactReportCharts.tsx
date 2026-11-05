import React from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { chartTooltipStyle } from "@/components/app/ChartGrid";

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
      <Tooltip contentStyle={chartTooltipStyle()} />
    </PieChart>
  );
}

export default ContactReportCharts;
