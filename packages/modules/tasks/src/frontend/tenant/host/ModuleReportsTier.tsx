import React from "react";
import { getTasksHost } from "../host.js";

type LooseComponent = React.ComponentType<Record<string, unknown>>;

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const Component = getTasksHost().ModuleReportsTier as LooseComponent;
  return <Component {...props} />;
}

export function ReportChartCard(props: Record<string, unknown>): React.JSX.Element {
  const Component = getTasksHost().ReportChartCard as LooseComponent | undefined;
  if (Component) return <Component {...props} />;
  return (
    <section>
      {props.title as React.ReactNode}
      {props.empty && props.emptyNode
        ? (props.emptyNode as React.ReactNode)
        : (props.children as React.ReactNode)}
    </section>
  );
}

export default ModuleReportsTier;
