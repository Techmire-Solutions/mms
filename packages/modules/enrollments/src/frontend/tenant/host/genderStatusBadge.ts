import { getEnrollmentsHost } from "../host.js";

export function genderStatusBadgeConfig(...args: any[]): any {
  const fn = (getEnrollmentsHost() as any).genderStatusBadge;
  return typeof fn === "function" ? fn(...args) : {};
}
