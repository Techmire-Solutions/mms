import { getExaminationsHost } from "../host.js";

export function useStudentsByIds(...args: any[]): any {
  return (getExaminationsHost() as any).useStudentsByIds(...args);
}
