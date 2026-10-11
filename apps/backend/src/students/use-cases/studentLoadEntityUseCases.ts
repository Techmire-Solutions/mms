import type { Student, StudentsListQuery, StudentsListPageResult } from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import { hydrateStudentsFromContacts } from "./studentHydrateUseCases.js";

/** Active (or deleted-only) student count via SQL — avoids loading every row. */
export async function countStudents(
  options?: { includeDeleted?: boolean },
  repo: StudentsRepository = studentsRepository,
): Promise<number> {
  const tenant = getRequestTenant();
  if (!tenant) return 0;
  const deleted = options?.includeDeleted ? "deleted" : "active";
  return repo.countByWorkspace(tenant, { deleted });
}

export async function loadStudentsPage(
  query: StudentsListQuery & { afterId?: string; skipCount?: boolean },
  repo: StudentsRepository = studentsRepository,
): Promise<StudentsListPageResult & { nextCursor?: string }> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      students: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      hasMore: false,
    };
  }
  const page = await repo.listPage(tenant, query);
  return {
    ...page,
    students: await hydrateStudentsFromContacts(tenant, page.students),
  };
}

export async function loadStudentById(
  id: string,
  includeDeleted = false,
  repo: StudentsRepository = studentsRepository,
): Promise<Student | null> {
  const tenant = getRequestTenant();
  if (!tenant) return null;
  const found = await repo.findById(tenant, id, { includeDeleted });
  if (!found) return null;
  if (!includeDeleted && found.deletedAt) return null;
  const [hydrated] = await hydrateStudentsFromContacts(tenant, [found]);
  return hydrated ?? null;
}

export async function loadStudentsByIds(
  ids: string[],
  repo: StudentsRepository = studentsRepository,
): Promise<Student[]> {
  if (ids.length === 0) return [];
  const tenant = getRequestTenant();
  if (!tenant) return [];
  const matched = repo.resolveByIdentifiers
    ? await repo.resolveByIdentifiers(tenant, ids)
    : await repo.findByIds(tenant, ids);
  return hydrateStudentsFromContacts(
    tenant,
    matched.filter((student) => !student.deletedAt),
  );
}

export async function loadStudentLinkedContactIds(
  excludeStudentId?: string,
  repo: StudentsRepository = studentsRepository,
): Promise<Array<string | number>> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return repo.listLinkedContactIds(tenant, excludeStudentId);
}
