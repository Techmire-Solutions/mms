import type {
  Faculty,
  FacultyListPageResult,
  FacultyListQuery,
  FacultyHierarchyNode,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";
import { hydrateFacultyFromContacts } from "./facultyHydrateUseCases.js";
import { ValidationError } from "../../lib/httpErrors.js";
import { findDirectSupervisorsBatch } from "../../db/repositories/facultyRepositorySubordinates.js";

/** Faculty count via SQL — avoids loading every row (active by default). */
export async function countFaculty(
  options?: { includeDeleted?: boolean },
  repo: FacultyRepository = facultyRepository,
): Promise<number> {
  const tenant = getRequestTenant();
  if (!tenant) return 0;
  return repo.countByWorkspace(tenant, { includeDeleted: options?.includeDeleted });
}

export async function loadFacultyPage(
  query: FacultyListQuery,
  repo: FacultyRepository = facultyRepository,
): Promise<FacultyListPageResult> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      faculty: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      hasMore: false,
    };
  }
  const page = await repo.listPage(tenant, query);
  const sourceList = page.faculty ?? [];
  let supervisors: Record<string, string> = {};
  try {
    supervisors = await findDirectSupervisorsBatch(
      tenant,
      sourceList.map((member) => String(member.id)),
    );
  } catch {
    supervisors = {};
  }
  const withSupervisors = sourceList.map((member) => ({
    ...member,
    reportingFacultyId: supervisors[String(member.id)] ?? member.reportingFacultyId ?? null,
  }));
  const hydrated = await hydrateFacultyFromContacts(tenant, withSupervisors);
  return {
    ...page,
    faculty: hydrated,
  };
}

export async function loadFacultyById(
  id: string,
  includeDeleted = false,
  repo: FacultyRepository = facultyRepository,
): Promise<Faculty | null> {
  const tenant = getRequestTenant();
  if (!tenant) return null;
  const found = await repo.findById(tenant, id);
  if (!found) return null;
  if (!includeDeleted && found.deletedAt) return null;
  const [hydrated] = await hydrateFacultyFromContacts(tenant, [found]);
  if (hydrated) {
    try {
      const supervisors = await findDirectSupervisorsBatch(tenant, [id]);
      hydrated.reportingFacultyId = supervisors[id] ?? hydrated.reportingFacultyId ?? null;
    } catch {
      // Position lookup unavailable in lightweight unit tests; keep hydrated value if any.
    }
    hydrated.subordinateCount = repo.countSubordinates
      ? await repo.countSubordinates(tenant, id)
      : 0;
  }
  return hydrated ?? null;
}

export async function loadFacultyByIds(
  ids: string[],
  repo: FacultyRepository = facultyRepository,
): Promise<Faculty[]> {
  if (ids.length === 0) return [];
  const tenant = getRequestTenant();
  if (!tenant) return [];
  const matched = await repo.findByIds(tenant, ids);
  return hydrateFacultyFromContacts(
    tenant,
    matched.filter((member: Faculty) => !member.deletedAt),
  );
}

export async function loadFacultyLinkedContactIds(
  excludeFacultyId?: string,
  repo: FacultyRepository = facultyRepository,
): Promise<Array<string | number>> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return repo.listLinkedContactIds(tenant, excludeFacultyId);
}

export async function loadHierarchyTree(
  repo: FacultyRepository = facultyRepository,
): Promise<{ nodes: FacultyHierarchyNode[] }> {
  const tenant = getRequestTenant();
  if (!tenant) return { nodes: [] };

  const pageResult = await repo.listPage(tenant, { limit: 100 });
  if (pageResult.total > 1000) {
    throw new ValidationError(
      `Faculty hierarchy tree is limited to 1000 members but this workspace has ${pageResult.total}. ` +
        `Use the paginated faculty list endpoint instead.`,
    );
  }
  const sourceList = [...(pageResult.faculty ?? [])];
  let hasMore = pageResult.hasMore;
  for (let page = 2; hasMore; page += 1) {
    if (page > 10) throw new ValidationError("Faculty hierarchy tree is limited to 1000 members");
    const next = await repo.listPage(tenant, { page, limit: 100 });
    sourceList.push(...(next.faculty ?? []));
    hasMore = next.hasMore;
  }
  const hydrated = await hydrateFacultyFromContacts(tenant, sourceList);
  let supervisors: Record<string, string>;
  try {
    supervisors = await findDirectSupervisorsBatch(
      tenant,
      hydrated.map((f) => String(f.id)),
    );
  } catch {
    supervisors = {};
  }

  const nodeMap = new Map<string, FacultyHierarchyNode>();
  for (const f of hydrated) {
    nodeMap.set(String(f.id), {
      id: String(f.id),
      contactId: f.contactId,
      name: f.name || f.employeeId || String(f.id),
      employeeId: f.employeeId,
      department: f.department,
      designation: f.designation,
      hierarchyRank: (f as { hierarchyRank?: number }).hierarchyRank ?? 10,
      status: f.status,
      avatar: f.avatar,
      reportingFacultyId:
        supervisors[String(f.id)] ??
        (f as { reportingFacultyId?: string | null }).reportingFacultyId ??
        null,
      subordinates: [],
    });
  }

  const rootNodes: FacultyHierarchyNode[] = [];
  for (const node of nodeMap.values()) {
    if (
      node.reportingFacultyId &&
      nodeMap.has(node.reportingFacultyId) &&
      node.reportingFacultyId !== node.id
    ) {
      const parent = nodeMap.get(node.reportingFacultyId)!;
      parent.subordinates.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  const sortNodes = (nodes: FacultyHierarchyNode[]) => {
    nodes.sort((a, b) => a.hierarchyRank - b.hierarchyRank || a.name.localeCompare(b.name));
    for (const n of nodes) {
      if (n.subordinates.length > 0) {
        sortNodes(n.subordinates);
      }
    }
  };

  sortNodes(rootNodes);
  return { nodes: rootNodes };
}

export const loadFacultyHierarchyTree = loadHierarchyTree;
