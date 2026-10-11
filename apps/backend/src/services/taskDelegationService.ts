import type { TaskAssigneeInput } from "@mms/shared";
import {
  findEligibleTaskRecipientRows,
  type TaskDelegationOptions,
  type TaskRecipientRow,
} from "../db/repositories/taskRecipientRepository.js";

export interface DelegationValidationResult {
  valid: boolean;
  resolvedAssignees: Array<{
    facultyId: string;
    facultyAssignmentId: string;
    userId: string;
  }>;
  reason?: string;
}

export function resolveTaskRecipients(
  inputs: readonly TaskAssigneeInput[],
  eligible: readonly TaskRecipientRow[],
): DelegationValidationResult {
  const resolved = new Map<string, DelegationValidationResult["resolvedAssignees"][number]>();
  for (const input of inputs) {
    const match = eligible.find(
      (row) =>
        row.facultyId === input.facultyId &&
        (!input.facultyAssignmentId || row.assignmentId === input.facultyAssignmentId) &&
        (!input.userId || row.userId === input.userId),
    );
    if (!match)
      return {
        valid: false,
        resolvedAssignees: [],
        reason: "Recipient is not eligible for this assignment",
      };
    resolved.set(match.userId, {
      facultyId: match.facultyId,
      facultyAssignmentId: match.assignmentId,
      userId: match.userId,
    });
  }
  return { valid: true, resolvedAssignees: [...resolved.values()] };
}

export async function validateTaskDelegation(
  tenant: string,
  actorUserId: string,
  inputs: TaskAssigneeInput[],
  options: TaskDelegationOptions = {},
): Promise<DelegationValidationResult> {
  if (!inputs.length) return { valid: true, resolvedAssignees: [] };
  const rows = await findEligibleTaskRecipientRows(tenant, actorUserId, options, [
    ...new Set(inputs.map((input) => input.facultyId)),
  ]);
  return resolveTaskRecipients(inputs, rows);
}
