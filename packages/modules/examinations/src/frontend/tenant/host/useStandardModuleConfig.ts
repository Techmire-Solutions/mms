import { getExaminationsHost } from "../host.js";

export function useExaminationConfig(...args: any[]): any {
  return (getExaminationsHost() as any).useExaminationConfig(...args);
}
