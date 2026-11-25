export interface FacultyCrossModuleKeys {
  contacts: readonly unknown[];
  students: readonly unknown[];
}

let keys: FacultyCrossModuleKeys | null = null;

export function configureFacultyCrossModuleKeys(next: FacultyCrossModuleKeys): void {
  keys = next;
}

export function contactsQueryKey(): readonly unknown[] {
  return keys?.contacts ?? ["contacts"];
}

export function studentsQueryKey(): readonly unknown[] {
  return keys?.students ?? ["students"];
}
