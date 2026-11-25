import { getSessionsHost } from "../host.js";

export function genderStatusBadgeConfig(...args: any[]): any {
  const fn = (getSessionsHost() as any).genderStatusBadgeConfig;
  return typeof fn === "function" ? fn(...args) : {};
}
