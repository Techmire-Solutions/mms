import type { FacultyAssignmentTreeNode as AssignmentTreeNode } from "@mms/shared";

export type { FacultyAssignmentTreeNode as AssignmentTreeNode } from "@mms/shared";

/** Organization hierarchy removed — manager chains are empty. */
export async function findAssignmentManagerChain(
  _tenant: string,
  _assignmentId: string,
  _maxDepth = 20,
  _onDate?: string,
): Promise<AssignmentTreeNode[]> {
  return [];
}

/** Organization hierarchy removed — subordinate trees are empty. */
export async function findAssignmentSubordinateTree(
  _tenant: string,
  _rootAssignmentId: string,
  _maxDepth = 20,
  _onDate?: string,
): Promise<AssignmentTreeNode[]> {
  return [];
}

export async function findFacultyManagerChain(
  _tenant: string,
  _facultyId: string,
  _onDate: string,
  _maxDepth = 20,
): Promise<AssignmentTreeNode[]> {
  return [];
}

export async function checkAssignmentCycleSafe(
  _tenant: string,
  childId: string,
  parentId: string,
  _maxDepth = 20,
): Promise<boolean> {
  return childId !== parentId;
}
