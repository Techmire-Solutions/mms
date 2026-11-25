import { useFinanceHostValue } from "../host.js";

export function useSessionsCollection(..._args: any[]) {
  const c = (useFinanceHostValue() as any).sessionsCollection;
  return c;
}
