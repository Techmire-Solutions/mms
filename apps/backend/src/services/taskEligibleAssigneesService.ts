import {
  findEligibleTaskRecipientRows,
  type TaskDelegationOptions,
  type TaskRecipientRow,
} from "../db/repositories/taskRecipientRepository.js";

export type EligibleTaskAssignee = TaskRecipientRow;

export async function getEligibleTaskAssignees(
  tenant: string,
  actorUserId: string,
  options: TaskDelegationOptions = {},
): Promise<EligibleTaskAssignee[]> {
  const rows = await findEligibleTaskRecipientRows(tenant, actorUserId, options);
  const recipients = new Map<string, EligibleTaskAssignee>();
  for (const row of rows) {
    if (!recipients.has(row.userId)) recipients.set(row.userId, row);
  }
  return [...recipients.values()];
}
