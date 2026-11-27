import { getIamHost } from "../host.js";

export function calculateReportDateRange(...args: any[]): any {
  return (getIamHost() as any).reportDateUtils.calculateReportDateRange(...args);
}
