import { emitOutboxEvent } from "../../services/outboxEventService.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  resolveFacultyCatalogCode,
  validateDepartmentDeletion,
  validateFacultyDepartment,
} from "./facultyDepartmentValidation.js";
import { and, eq, isNull, sql } from "drizzle-orm";
import { facultyDepartments } from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import type { FacultyCatalogStatus, FacultyDepartmentEntity } from "@mms/shared";

export { FacultyCatalogConflictError } from "./facultyDepartmentValidation.js";

/** Write input under the Faculty Management model (name / description / status). */
export interface FacultyDepartmentWriteInput {
  id: string;
  name: string;
  description?: string | null;
  status?: FacultyCatalogStatus;
  updatedBy?: string | null;
}

const designationCountExpr = sql<number>`(
  select count(*)::int from faculty_designations d
  where d.workspace_subdomain = ${facultyDepartments.workspaceSubdomain}
    and d.department_id = ${facultyDepartments.id}
    and d.deleted_at is null
)`;

const FACULTY_DEPARTMENT_COLUMNS = {
  id: facultyDepartments.id,
  workspaceSubdomain: facultyDepartments.workspaceSubdomain,
  name: facultyDepartments.name,
  description: facultyDepartments.description,
  status: facultyDepartments.status,
  code: facultyDepartments.code,
  isActive: facultyDepartments.isActive,
  designationCount: designationCountExpr,
  deletedAt: facultyDepartments.deletedAt,
  createdAt: facultyDepartments.createdAt,
  updatedAt: facultyDepartments.updatedAt,
};

type DepartmentSelection = {
  id: string;
  workspaceSubdomain: string;
  name: string;
  description: string | null;
  status: string;
  code: string | null;
  isActive: boolean;
  designationCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDepartmentEntity(row: DepartmentSelection): FacultyDepartmentEntity {
  const status: FacultyCatalogStatus = row.status === "inactive" ? "inactive" : "active";
  return {
    id: row.id,
    workspaceSubdomain: row.workspaceSubdomain,
    name: row.name,
    description: row.description,
    status,
    isActive: status === "active",
    code: row.code,
    designationCount: Number(row.designationCount ?? 0),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Reads a live department inside an existing tenant transaction. */
export async function selectDepartmentById(
  tx: TenantTransaction,
  subdomain: string,
  id: string,
): Promise<FacultyDepartmentEntity | null> {
  const rows = await tx
    .select(FACULTY_DEPARTMENT_COLUMNS)
    .from(facultyDepartments)
    .where(
      and(
        eq(facultyDepartments.workspaceSubdomain, subdomain),
        eq(facultyDepartments.id, id),
        isNull(facultyDepartments.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ? toDepartmentEntity(rows[0]) : null;
}

/* ── Read helpers ─────────────────────────────────────────────────────────── */

export async function findFacultyDepartmentById(
  tenant: string,
  id: string,
): Promise<FacultyDepartmentEntity | null> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, (tx) => selectDepartmentById(tx, subdomain, id));
}

/** Default API cap; pass `limit: null` for export/import jobs that need the full catalog. */
const FACULTY_CATALOG_LIST_DEFAULT_LIMIT = 500;
const FACULTY_CATALOG_LIST_MAX_LIMIT = 5000;

export async function listFacultyDepartments(
  tenant: string,
  options: { includeDeleted?: boolean; limit?: number | null } = {},
): Promise<FacultyDepartmentEntity[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const condition = options.includeDeleted
      ? eq(facultyDepartments.workspaceSubdomain, subdomain)
      : and(
          eq(facultyDepartments.workspaceSubdomain, subdomain),
          isNull(facultyDepartments.deletedAt),
        );
    const base = tx
      .select(FACULTY_DEPARTMENT_COLUMNS)
      .from(facultyDepartments)
      .where(condition)
      .orderBy(facultyDepartments.name);
    const rows =
      options.limit === null
        ? await base
        : await base.limit(
            Math.min(
              Math.max(1, options.limit ?? FACULTY_CATALOG_LIST_DEFAULT_LIMIT),
              FACULTY_CATALOG_LIST_MAX_LIMIT,
            ),
          );
    return rows.map(toDepartmentEntity);
  });
}

/* ── Write helpers ────────────────────────────────────────────────────────── */

export async function saveFacultyDepartment(
  tenant: string,
  input: FacultyDepartmentWriteInput,
): Promise<FacultyDepartmentEntity> {
  const subdomain = tenant.trim().toLowerCase();
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  const status: FacultyCatalogStatus = input.status ?? "active";
  return withTenant(subdomain, async (tx) => {
    await validateFacultyDepartment(tx, subdomain, { id: input.id, name });
    const code = await resolveFacultyCatalogCode(
      tx,
      "faculty_departments",
      subdomain,
      input.id,
      name,
    );
    const now = new Date();
    await tx
      .insert(facultyDepartments)
      .values({
        id: input.id,
        workspaceSubdomain: subdomain,
        name,
        description,
        status,
        code,
        isActive: status === "active",
        createdBy: input.updatedBy ?? null,
        updatedBy: input.updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: [facultyDepartments.workspaceSubdomain, facultyDepartments.id],
        set: {
          name,
          description,
          status,
          isActive: status === "active",
          updatedAt: now,
          updatedBy: input.updatedBy ?? null,
        },
      });
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty_departments",
      recordId: input.id,
      actionType: "UPDATE",
      realUserId: input.updatedBy ?? undefined,
      newState: { id: input.id, name, description, status },
    });
    const saved = await selectDepartmentById(tx, subdomain, input.id);
    if (!saved) throw new Error("Failed to retrieve saved department");
    return saved;
  });
}

export async function softDeleteFacultyDepartment(
  tenant: string,
  id: string,
  deletedBy: string,
  reason?: string,
): Promise<void> {
  const subdomain = tenant.trim().toLowerCase();
  await withTenant(subdomain, async (tx) => {
    await validateDepartmentDeletion(tx, subdomain, id);
    const deletedAt = new Date();
    const changed = await tx
      .update(facultyDepartments)
      .set({
        deletedAt,
        deletedBy,
        deletionReason: reason ?? null,
        status: "inactive",
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facultyDepartments.workspaceSubdomain, subdomain),
          eq(facultyDepartments.id, id),
          isNull(facultyDepartments.deletedAt),
        ),
      )
      .returning({ id: facultyDepartments.id });
    if (!changed.length) return;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "faculty_departments",
      recordId: id,
      actionType: "DELETE",
      realUserId: deletedBy,
      newState: { reason: reason ?? null },
    });
    await emitOutboxEvent(tx, "entity.soft_deleted", {
      entityType: "faculty_departments",
      entityId: id,
      tenantId: subdomain,
      deletedAt: deletedAt.toISOString(),
      deletedBy,
      deletionReason: reason,
      version: deletedAt.getTime(),
    });
  });
}
