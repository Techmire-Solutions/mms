import { getEnrollmentsHost } from "../host.js";

const host = () => (getEnrollmentsHost() as any).studentStatusUi;

export function studentStatusBadgeConfig(...args: any[]): any {
  const fn = host()?.studentStatusBadgeConfig;
  return typeof fn === "function" ? fn(...args) : {};
}

export const studentStatusUi = {
  studentStatusBadgeConfig,
};

export default studentStatusUi;
