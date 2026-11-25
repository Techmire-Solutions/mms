import { getStudentsHost } from "../host.js";

export function useStudentConfig(...args: any[]): any {
  return (getStudentsHost() as any).useStudentConfig(...args);
}
