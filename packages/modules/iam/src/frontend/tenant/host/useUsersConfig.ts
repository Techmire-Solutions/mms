import { getIamHost } from "../host.js";

export function useUsersConfig(...args: any[]): any {
  return (getIamHost() as any).useUsersConfig(...args);
}
