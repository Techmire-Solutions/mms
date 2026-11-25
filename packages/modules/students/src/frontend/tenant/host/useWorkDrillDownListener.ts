import { getStudentsHost } from "../host.js";

export function useWorkDrillDownListener(...args: any[]): any {
  return (getStudentsHost() as any).useWorkDrillDownListener(...args);
}
