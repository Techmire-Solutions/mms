import { getSessionsHost } from "../host.js";

export const facultyCollection: any = new Proxy(
  {},
  {
    get: (_t, prop) => (getSessionsHost() as any).facultyCollection?.[prop],
  },
);

export function useFacultyContractList(...args: any[]): any {
  return (getSessionsHost() as any).facultyCollection?.useFacultyContractList?.(...args);
}

export function useFacultyByIds(...args: any[]): any {
  return (getSessionsHost() as any).facultyCollection?.useFacultyByIds?.(...args);
}
