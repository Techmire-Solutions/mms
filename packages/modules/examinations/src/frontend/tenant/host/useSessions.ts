import { getExaminationsHost } from "../host.js";

export function useSessionsCollection(...args: any[]): any {
  return (getExaminationsHost() as any).useSessionsCollection(...args);
}
