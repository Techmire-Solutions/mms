import { getSessionsHost } from "../host.js";

export function useSessionConfig(...args: any[]): any {
  return (getSessionsHost() as any).useSessionConfig(...args);
}
