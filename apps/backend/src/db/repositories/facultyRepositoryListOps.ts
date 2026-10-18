import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  DEFAULT_FACULTY_STATUS,
  dedupeTrimmedIds,
  MODULE_METRICS_DEFAULT_PERIOD_DAYS,
  resolveFacultyStatusRoles,
  type FacultyCommandMetricsSnapshot,
} from "@mms/shared";
import { faculty, facultyEmployments } from "../schema.js";
import { withTenant, withTenantRead } from "../tenant-context.js";
import { facultyStatusExpr } from "./facultyRepositoryListQuerySql.js";

const feEmp = alias(facultyEmployments, "fe_emp");

/**
 * Set typed `status` for active faculty in one UPDATE.
 * Returns how many rows were updated; callers treat missing/deleted ids as failed.
 */
export async function bulkUpdateFacultyStatusSql(
  workspaceSubdomain: string,
  ids: string[],
  status: string,
): Promise<number> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (!subdomain || uniqueIds.length === 0) return 0;
  const normalizedStatus = status.trim().toLowerCase() || DEFAULT_FACULTY_STATUS;

  return withTenant(subdomain, async (tx) => {
    const linked = await tx
      .select({ employmentId: faculty.employmentId })
      .from(faculty)
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          inArray(faculty.id, uniqueIds),
          isNull(faculty.deletedAt),
        ),
      );
    const employmentIds = linked
      .map((row) => row.employmentId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (employmentIds.length === 0) return 0;
    const updated = await tx
      .update(facultyEmployments)
      .set({
        status: normalizedStatus,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facultyEmployments.workspaceSubdomain, subdomain),
          inArray(facultyEmployments.id, employmentIds),
          isNull(facultyEmployments.deletedAt),
        ),
      )
      .returning({ id: facultyEmployments.id });
    return updated.length;
  });
}

/**
 * Set typed `specialization` for active faculty in one UPDATE.
 * Returns how many rows were updated; callers treat missing/deleted ids as failed.
 */
export async function bulkUpdateFacultySpecializationSql(
  workspaceSubdomain: string,
  ids: string[],
  specialization: string,
): Promise<number> {
  const subdomain = workspaceSubdomain.trim().toLowerCase();
  const uniqueIds = dedupeTrimmedIds(ids);
  if (!subdomain || uniqueIds.length === 0) return 0;
  const normalizedSpecialization = specialization.trim();

  return withTenant(subdomain, async (tx) => {
    const updated = await tx
      .update(faculty)
      .set({
        specialization: normalizedSpecialization || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(faculty.workspaceSubdomain, subdomain),
          inArray(faculty.id, uniqueIds),
          isNull(faculty.deletedAt),
        ),
      )
      .returning({ id: faculty.id });
    return updated.length;
  });
}

/** SQL aggregates for Faculty command-centre metrics (active rows only). */
export async function aggregateFacultyCommandMetrics(
  tenant: string,
  periodDays: number = MODULE_METRICS_DEFAULT_PERIOD_DAYS,
): Promise<FacultyCommandMetricsSnapshot> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const joinDateExpr = sql`COALESCE(
      ${feEmp.employmentStartDate},
      (${faculty.createdAt})::date
    )`;
    const status = facultyStatusExpr();
    const {
      active: activeStatus,
      inactive: inactiveStatus,
      onLeave: onLeaveStatus,
    } = resolveFacultyStatusRoles();

    const rows = await tx
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) FILTER (WHERE ${status} = ${activeStatus})::int`,
        inactive: sql<number>`count(*) FILTER (WHERE ${status} = ${inactiveStatus})::int`,
        onLeave: sql<number>`count(*) FILTER (WHERE ${status} = ${onLeaveStatus})::int`,
        other: sql<number>`count(*) FILTER (WHERE ${status} IS NOT NULL AND ${status} <> '' AND ${status} NOT IN (${activeStatus}, ${inactiveStatus}, ${onLeaveStatus}))::int`,
        newThisPeriod: sql<number>`count(*) FILTER (WHERE
          ${joinDateExpr} >= (CURRENT_DATE - (${periodDays} * INTERVAL '1 day'))::date
        )::int`,
      })
      .from(faculty)
      .leftJoin(
        feEmp,
        and(
          eq(feEmp.workspaceSubdomain, faculty.workspaceSubdomain),
          eq(feEmp.id, faculty.employmentId),
          isNull(feEmp.deletedAt),
        ),
      )
      .where(and(eq(faculty.workspaceSubdomain, subdomain), isNull(faculty.deletedAt)));

    const row = rows[0];
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      inactive: Number(row?.inactive ?? 0),
      onLeave: Number(row?.onLeave ?? 0),
      other: Number(row?.other ?? 0),
      newThisPeriod: Number(row?.newThisPeriod ?? 0),
    };
  });
}
