import { getWorkshopsHost } from "../host.js";

export function useCurrency(...args: any[]): any {
  return (getWorkshopsHost() as any).useCurrency(...args);
}
