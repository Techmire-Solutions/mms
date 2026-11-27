import { getObligationsHost } from "../host.js";

export function useContactsByIds(...args: any[]): any {
  return (getObligationsHost() as any).useContactsByIds(...args);
}
