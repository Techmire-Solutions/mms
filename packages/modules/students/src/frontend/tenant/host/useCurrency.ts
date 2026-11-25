import { getStudentsHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getStudentsHost() as any).useCurrency(...args);
}
