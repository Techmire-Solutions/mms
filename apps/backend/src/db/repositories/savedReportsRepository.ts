import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type {
  GenericSavedReport,
  GenericSavedReportCategory,
  GenericSavedReportCreateInput,
  PersistedSavedReportCategory,
} from "@mms/shared";
import { CONTACTS_SAVED_REPORT_CATEGORY } from "@mms/shared";
import { savedReports } from "../schema.js";
import { withTenant } from "../tenant-context.js";

export interface CreateSavedReportRecord extends GenericSavedReportCreateInput {
  createdBy: string;
  createdByName: string;
}

export interface CreatePersistedSavedReportRecord {
  id?: string;
  name: string;
  category: PersistedSavedReportCategory;
  filters: Record<string, unknown>;
  createdBy: string;
  createdByName: string;
  lastRunAt?: Date;
  createdAt?: Date;
}
import {
  SAVED_REPORT_SELECT_FIELDS,
  toGenericSavedReport,
  listAllSavedReportsByWorkspace,
  replaceSavedReportsForWorkspace,
} from "./savedReportsAdminRepository.js";

export {
  SAVED_REPORT_SELECT_FIELDS,
  toGenericSavedReport,
  listAllSavedReportsByWorkspace,
  replaceSavedReportsForWorkspace,
};


export async function listSavedReportsByOwner(
  workspaceSubdomain: string,
  category: GenericSavedReportCategory,
  createdBy: string,
  options?: { limit?: number; offset?: number },
): Promise<GenericSavedReport[]> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 100), 500);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select(SAVED_REPORT_SELECT_FIELDS)
      .from(savedReports)
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.category, category),
          eq(savedReports.createdBy, createdBy),
        ),
      )
      .orderBy(desc(savedReports.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toGenericSavedReport);
  });
}

export async function listSavedReportsByCategory(
  workspaceSubdomain: string,
  category: PersistedSavedReportCategory,
  options?: { limit?: number; offset?: number },
): Promise<GenericSavedReport[]> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const limit = Math.min(Math.max(1, options?.limit ?? 200), 500);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select(SAVED_REPORT_SELECT_FIELDS)
      .from(savedReports)
      .where(and(eq(savedReports.workspaceSubdomain, tenant), eq(savedReports.category, category)))
      .orderBy(desc(savedReports.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toGenericSavedReport);
  });
}

export async function findSavedReportByOwner(
  workspaceSubdomain: string,
  id: string,
  category: GenericSavedReportCategory,
  createdBy: string,
): Promise<GenericSavedReport | null> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select(SAVED_REPORT_SELECT_FIELDS)
      .from(savedReports)
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
          eq(savedReports.createdBy, createdBy),
        ),
      )
      .limit(1);
    return rows[0] ? toGenericSavedReport(rows[0]) : null;
  });
}

export async function findSavedReportById(
  workspaceSubdomain: string,
  id: string,
  category: PersistedSavedReportCategory,
): Promise<GenericSavedReport | null> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .select(SAVED_REPORT_SELECT_FIELDS)
      .from(savedReports)
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
        ),
      )
      .limit(1);
    return rows[0] ? toGenericSavedReport(rows[0]) : null;
  });
}

export async function createSavedReportForOwner(
  workspaceSubdomain: string,
  input: CreateSavedReportRecord,
): Promise<GenericSavedReport> {
  return createPersistedSavedReport(workspaceSubdomain, input);
}

export async function createPersistedSavedReport(
  workspaceSubdomain: string,
  input: CreatePersistedSavedReportRecord,
): Promise<GenericSavedReport> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const now = new Date();
  const values = {
    id: input.id ?? randomUUID(),
    workspaceSubdomain: tenant,
    category: input.category,
    name: input.name,
    filters: input.filters,
    lastRunAt: input.lastRunAt ?? now,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };

  return withTenant(tenant, async (tx) => {
    const rows = await tx.insert(savedReports).values(values).returning();
    return toGenericSavedReport(rows[0]!);
  });
}

export async function deleteSavedReportByOwner(
  workspaceSubdomain: string,
  id: string,
  category: GenericSavedReportCategory,
  createdBy: string,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .delete(savedReports)
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
          eq(savedReports.createdBy, createdBy),
        ),
      )
      .returning({ id: savedReports.id });
    return rows.length > 0;
  });
}

export async function deleteSavedReportById(
  workspaceSubdomain: string,
  id: string,
  category: PersistedSavedReportCategory,
): Promise<boolean> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .delete(savedReports)
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
        ),
      )
      .returning({ id: savedReports.id });
    return rows.length > 0;
  });
}

export async function touchSavedReportRunByOwner(
  workspaceSubdomain: string,
  id: string,
  category: GenericSavedReportCategory,
  createdBy: string,
): Promise<GenericSavedReport | null> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const now = new Date();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .update(savedReports)
      .set({ lastRunAt: now, updatedAt: now })
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
          eq(savedReports.createdBy, createdBy),
        ),
      )
      .returning();
    return rows[0] ? toGenericSavedReport(rows[0]) : null;
  });
}

export async function touchSavedReportRunById(
  workspaceSubdomain: string,
  id: string,
  category: PersistedSavedReportCategory,
): Promise<GenericSavedReport | null> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const now = new Date();
  return withTenant(tenant, async (tx) => {
    const rows = await tx
      .update(savedReports)
      .set({ lastRunAt: now, updatedAt: now })
      .where(
        and(
          eq(savedReports.workspaceSubdomain, tenant),
          eq(savedReports.id, id),
          eq(savedReports.category, category),
        ),
      )
      .returning();
    return rows[0] ? toGenericSavedReport(rows[0]) : null;
  });
}
export { CONTACTS_SAVED_REPORT_CATEGORY };
