import React from "react";
import { getAttendanceHost } from "../host.js";

type LooseComponent = React.ComponentType<Record<string, unknown>>;

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAttendanceHost().ModuleReportsTier as LooseComponent;
  return <Component {...props} />;
}

export function ReportChartCard(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAttendanceHost().ReportChartCard as LooseComponent | undefined;
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

export function KPISummary(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAttendanceHost().KPISummary as LooseComponent | undefined;
  return Component ? (
    <Component {...props} />
  ) : (
    <section>{props.children as React.ReactNode}</section>
  );
}

export function ModuleReports(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAttendanceHost().ModuleReports as LooseComponent | undefined;
  return Component ? (
    <Component {...props} />
  ) : (
    <section>{props.children as React.ReactNode}</section>
  );
}

export default ModuleReportsTier;
