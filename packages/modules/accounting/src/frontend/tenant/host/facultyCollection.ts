import { getAccountingHost } from "../host.js";

export function facultyResolveQueryOptions(ids: string[]): {
  queryKey: readonly unknown[];
  queryFn: () => Promise<
    Array<{ id: string; name?: string; employeeId?: string; designation?: string }>
  >;
} {
  return getAccountingHost().facultyResolveQueryOptions(ids);
}
