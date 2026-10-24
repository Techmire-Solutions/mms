/**
 * @file tasksAssigneesRepository.ts
 * @description Persistence and query operations for task assignees.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { TaskAssigneeRecord } from "@mms/shared";
import { contacts, faculty, facultyEmployments, taskAssignees, tenantUsers } from "../schema.js";
import type { TenantTransaction } from "../tenant-context.js";

export async function fetchAssigneesByTaskIds(
  tx: TenantTransaction,
  subdomain: string,
  taskIds: string[],
): Promise<Map<string, TaskAssigneeRecord[]>> {
  if (taskIds.length === 0) return new Map();

  const assigneesRows = await tx
    .select({
      id: taskAssignees.id,
      taskId: taskAssignees.taskId,
      facultyId: taskAssignees.facultyId,
      facultyAssignmentId: taskAssignees.facultyAssignmentId,
      userId: taskAssignees.userId,
      assignedAt: taskAssignees.assignedAt,
      contactFirstName: contacts.firstName,
      contactLastName: contacts.lastName,
      userEmail: tenantUsers.loginEmail,
    })
    .from(taskAssignees)
    .leftJoin(
      faculty,
      and(
        eq(taskAssignees.facultyId, faculty.id),
        eq(faculty.workspaceSubdomain, subdomain),
        isNull(faculty.deletedAt),
      ),
    )
    .leftJoin(
      facultyEmployments,
      and(
        eq(faculty.workspaceSubdomain, facultyEmployments.workspaceSubdomain),
        eq(faculty.employmentId, facultyEmployments.id),
        isNull(facultyEmployments.deletedAt),
      ),
    )
    .leftJoin(
      contacts,
      and(
        eq(facultyEmployments.contactId, contacts.id),
        eq(contacts.workspaceSubdomain, subdomain),
        isNull(contacts.deletedAt),
      ),
    )
    .leftJoin(
      tenantUsers,
      and(
        eq(taskAssignees.userId, tenantUsers.id),
        eq(tenantUsers.workspaceSubdomain, subdomain),
        isNull(tenantUsers.deletedAt),
      ),
    )
    .where(
      and(
        eq(taskAssignees.workspaceSubdomain, subdomain),
        inArray(taskAssignees.taskId, taskIds),
        isNull(taskAssignees.deletedAt),
      ),
    );

  const assigneesByTaskId = new Map<string, TaskAssigneeRecord[]>();
  for (const a of assigneesRows) {
    const list = assigneesByTaskId.get(a.taskId) ?? [];
    list.push({
      id: a.id,
      taskId: a.taskId,
      facultyId: a.facultyId,
      facultyAssignmentId: a.facultyAssignmentId,
      userId: a.userId,
      facultyName: [a.contactFirstName, a.contactLastName].filter(Boolean).join(" ") || undefined,
      userEmail: a.userEmail ?? undefined,
      assignedAt: a.assignedAt ? a.assignedAt.toISOString() : undefined,
    });
    assigneesByTaskId.set(a.taskId, list);
  }

  return assigneesByTaskId;
}

export async function syncTaskAssignees(
  tx: TenantTransaction,
  subdomain: string,
  taskId: string,
  assignees: Array<{
    facultyId: string;
    facultyAssignmentId?: string | null;
    userId: string;
  }>,
  actorUserId?: string,
): Promise<void> {
  await tx
    .update(taskAssignees)
    .set({ deletedAt: new Date(), deletedBy: actorUserId ?? null })
    .where(
      and(
        eq(taskAssignees.workspaceSubdomain, subdomain),
        eq(taskAssignees.taskId, taskId),
        isNull(taskAssignees.deletedAt),
      ),
    );

  if (!assignees.length) return;
  await tx.insert(taskAssignees).values(
    assignees.map((a) => ({
      id: crypto.randomUUID(),
      workspaceSubdomain: subdomain,
      taskId,
      facultyId: a.facultyId,
      facultyAssignmentId: a.facultyAssignmentId ?? null,
      userId: a.userId,
      assignedByUserId: actorUserId ?? "system",
    })),
  );
}
