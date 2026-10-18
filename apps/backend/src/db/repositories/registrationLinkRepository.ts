import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RegistrationLink } from "@mms/shared";
import {
  registrationApplications,
  registrationLinkClasses,
  sessionRegistrationLinks,
} from "../schema.js";
import { withTenant, withTenantRead, type TenantTransaction } from "../tenant-context.js";
import { NotFoundError } from "../../lib/httpErrors.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";

const t = sessionRegistrationLinks;
const columns = {
  id: t.id,
  sessionId: t.sessionId,
  slug: t.slug,
  title: t.title,
  isActive: t.isActive,
  opensAt: t.opensAt,
  closesAt: t.closesAt,
  maxSubmissions: t.maxSubmissions,
  requiresReview: t.requiresReview,
  deletedAt: t.deletedAt,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
};
type LinkSelection = {
  id: string;
  sessionId: string;
  slug: string;
  title: string | null;
  isActive: boolean;
  opensAt: Date | null;
  closesAt: Date | null;
  maxSubmissions: number | null;
  requiresReview: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface RegistrationLinkSaveInput {
  id: string;
  sessionId: string;
  title: string | null;
  isActive: boolean;
  opensAt: string | null;
  closesAt: string | null;
  maxSubmissions: number | null;
  requiresReview: boolean;
  classIds: string[];
  actorUserId: string;
}

/** 128-bit random, URL-safe slug (unguessable; links are shared publicly). */
export function generateRegistrationSlug(): string {
  return randomBytes(16).toString("base64url");
}

async function hydrateLinksTx(
  tx: TenantTransaction,
  subdomain: string,
  rows: LinkSelection[],
): Promise<RegistrationLink[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const classes = await tx
    .select({ linkId: registrationLinkClasses.linkId, classId: registrationLinkClasses.classId })
    .from(registrationLinkClasses)
    .where(
      and(
        eq(registrationLinkClasses.workspaceSubdomain, subdomain),
        inArray(registrationLinkClasses.linkId, ids),
      ),
    );
  const counts = await tx
    .select({ linkId: registrationApplications.linkId, count: sql<number>`count(*)::int` })
    .from(registrationApplications)
    .where(
      and(
        eq(registrationApplications.workspaceSubdomain, subdomain),
        inArray(registrationApplications.linkId, ids),
        isNull(registrationApplications.deletedAt),
      ),
    )
    .groupBy(registrationApplications.linkId);
  const countOf = new Map(counts.map((row) => [row.linkId, Number(row.count)]));
  return rows.map((row) => ({
    ...row,
    opensAt: row.opensAt?.toISOString() ?? null,
    closesAt: row.closesAt?.toISOString() ?? null,
    classIds: classes.filter((entry) => entry.linkId === row.id).map((entry) => entry.classId),
    submissionCount: countOf.get(row.id) ?? 0,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listRegistrationLinks(
  tenant: string,
  sessionId: string,
): Promise<RegistrationLink[]> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenantRead(subdomain, async (tx) => {
    const rows = await tx
      .select(columns)
      .from(t)
      .where(
        and(eq(t.workspaceSubdomain, subdomain), eq(t.sessionId, sessionId), isNull(t.deletedAt)),
      )
      .orderBy(asc(t.createdAt))
      .limit(200);
    return hydrateLinksTx(tx, subdomain, rows);
  });
}

/** Active links of the workspace (public "open sessions" board). */
export async function listActiveRegistrationLinksTx(
  tx: TenantTransaction,
  subdomain: string,
): Promise<RegistrationLink[]> {
  const rows = await tx
    .select(columns)
    .from(t)
    .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.isActive, true), isNull(t.deletedAt)))
    .orderBy(asc(t.createdAt))
    .limit(100);
  return hydrateLinksTx(tx, subdomain, rows);
}

/** Serializes submissions per link so the cap and duplicate guard hold under concurrency. */
export async function lockRegistrationLinkTx(
  tx: TenantTransaction,
  subdomain: string,
  linkId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`${subdomain}:registration:${linkId}`}))`,
  );
}

export async function findRegistrationLinkBySlugTx(
  tx: TenantTransaction,
  subdomain: string,
  slug: string,
): Promise<RegistrationLink | null> {
  const rows = await tx
    .select(columns)
    .from(t)
    .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.slug, slug), isNull(t.deletedAt)))
    .limit(1);
  const [link] = await hydrateLinksTx(tx, subdomain, rows);
  return link ?? null;
}

export async function saveRegistrationLink(
  tenant: string,
  input: RegistrationLinkSaveInput,
): Promise<RegistrationLink> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const fields = {
      title: input.title,
      isActive: input.isActive,
      maxSubmissions: input.maxSubmissions,
      requiresReview: input.requiresReview,
      opensAt: input.opensAt ? new Date(input.opensAt) : null,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
    };
    const [existing] = await tx
      .select({ sessionId: t.sessionId })
      .from(t)
      .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.id, input.id)))
      .limit(1);
    if (existing && existing.sessionId !== input.sessionId)
      throw new NotFoundError("Registration link not found");
    await tx
      .insert(t)
      .values({
        id: input.id,
        workspaceSubdomain: subdomain,
        sessionId: input.sessionId,
        slug: generateRegistrationSlug(),
        ...fields,
        createdBy: input.actorUserId,
      })
      .onConflictDoUpdate({
        target: [t.workspaceSubdomain, t.id],
        set: { ...fields, updatedAt: new Date() },
        setWhere: isNull(t.deletedAt),
      });
    await tx
      .delete(registrationLinkClasses)
      .where(
        and(
          eq(registrationLinkClasses.workspaceSubdomain, subdomain),
          eq(registrationLinkClasses.linkId, input.id),
        ),
      );
    if (input.classIds.length > 0) {
      await tx.insert(registrationLinkClasses).values(
        [...new Set(input.classIds)].map((classId) => ({
          workspaceSubdomain: subdomain,
          linkId: input.id,
          classId,
        })),
      );
    }
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "session_registration_links",
      recordId: input.id,
      actionType: existing ? "UPDATE" : "CREATE",
      realUserId: input.actorUserId,
      newState: { ...fields, classIds: input.classIds },
    });
    const rows = await tx
      .select(columns)
      .from(t)
      .where(and(eq(t.workspaceSubdomain, subdomain), eq(t.id, input.id)))
      .limit(1);
    const [saved] = await hydrateLinksTx(tx, subdomain, rows);
    if (!saved || saved.deletedAt) throw new NotFoundError("Registration link not found");
    return saved;
  });
}

export async function softDeleteRegistrationLink(
  tenant: string,
  sessionId: string,
  id: string,
  actorUserId: string,
): Promise<boolean> {
  const subdomain = tenant.trim().toLowerCase();
  return withTenant(subdomain, async (tx) => {
    const deletedAt = new Date();
    const changed = await tx
      .update(t)
      .set({
        deletedAt,
        deletedBy: actorUserId,
        deletionReason: "User deleted",
        isActive: false,
        updatedAt: deletedAt,
      })
      .where(
        and(
          eq(t.workspaceSubdomain, subdomain),
          eq(t.sessionId, sessionId),
          eq(t.id, id),
          isNull(t.deletedAt),
        ),
      )
      .returning({ id: t.id });
    if (changed.length === 0) return false;
    await recordModernAuditEvent(tx, {
      workspaceSubdomain: subdomain,
      tableName: "session_registration_links",
      recordId: id,
      actionType: "DELETE",
      realUserId: actorUserId,
    });
    return true;
  });
}
