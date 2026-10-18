import type { Faculty } from "@mms/shared";

/** Organization hierarchy removed — no position-based subordinates. */
export async function findSubordinates(_tenant: string, _supervisorId: string): Promise<Faculty[]> {
  return [];
}

export async function findDirectSupervisorsBatch(
  _tenant: string,
  _facultyIds: string[],
): Promise<Record<string, string>> {
  return {};
}

export async function findAncestorChain(
  _tenant: string,
  _facultyId: string,
  _maxDepth?: number,
): Promise<string[]> {
  return [];
}
