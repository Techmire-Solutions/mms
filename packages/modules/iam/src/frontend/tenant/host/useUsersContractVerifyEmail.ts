import { getIamHost } from "../host.js";

export function useUsersContractVerifyEmail(...args: any[]): any {
  return (getIamHost() as any).useUsersContractVerifyEmail(...args);
}
