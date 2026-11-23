import { and, count, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { PlatformContactDto } from "@mms/shared";
import { platformContacts } from "../schema.js";
import { withGlobalTenant } from "../tenant-context.js";
import { randomUUID } from "node:crypto";

interface ContactFilters {
  search?: string;
  kind?: string;
  limit: number;
  offset: number;
  includeDeleted?: boolean;
}

const contactColumns = {
  id: platformContacts.id,
  name: platformContacts.name,
  email: platformContacts.email,
  phone: platformContacts.phone,
  kind: platformContacts.kind,
  workspaceId: platformContacts.workspaceId,
  tags: platformContacts.tags,
  notes: platformContacts.notes,
  createdAt: platformContacts.createdAt,
  updatedAt: platformContacts.updatedAt,
  deletedAt: platformContacts.deletedAt,
};

function toDto(row: typeof platformContacts.$inferSelect): PlatformContactDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    kind: row.kind as PlatformContactDto["kind"],
    workspaceId: row.workspaceId ?? null,
    tags: (row.tags ?? []) as PlatformContactDto["tags"],
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export async function listPlatformContacts(filters: ContactFilters): Promise<PlatformContactDto[]> {
  return withGlobalTenant(async (tx) => {
    const conditions = filters.includeDeleted ? [] : [isNull(platformContacts.deletedAt)];
    if (filters.kind) conditions.push(eq(platformContacts.kind, filters.kind));
    if (filters.search) {
      conditions.push(
        or(
          ilike(platformContacts.name, `%${filters.search}%`),
          ilike(platformContacts.email, `%${filters.search}%`),
          ilike(platformContacts.phone, `%${filters.search}%`),
        )!,
      );
    }
    const rows = await tx
      .select(contactColumns)
      .from(platformContacts)
      .where(and(...conditions))
      .orderBy(platformContacts.name)
      .limit(filters.limit)
      .offset(filters.offset);
    return rows.map(toDto);
  });
}

export async function getPlatformContact(id: string): Promise<PlatformContactDto | null> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .select(contactColumns)
      .from(platformContacts)
      .where(and(eq(platformContacts.id, id), isNull(platformContacts.deletedAt)))
      .limit(1);
    return rows[0] ? toDto(rows[0]) : null;
  });
}

export async function createPlatformContact(input: {
  name: string;
  email?: string | null;
  phone?: string | null;
  kind: string;
  workspaceId?: string | null;
  tags: Array<{ id: string; label: string }>;
  notes?: string | null;
}): Promise<PlatformContactDto> {
  const id = randomUUID();
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .insert(platformContacts)
      .values({
        id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        kind: input.kind,
        workspaceId: input.workspaceId ?? null,
        tags: input.tags,
        notes: input.notes ?? null,
      })
      .returning();
    return toDto(rows[0]);
  });
}

export async function updatePlatformContact(
  id: string,
  input: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    tags?: Array<{ id: string; label: string }>;
    notes?: string | null;
  },
): Promise<PlatformContactDto | null> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .update(platformContacts)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(platformContacts.id, id), isNull(platformContacts.deletedAt)))
      .returning();
    return rows[0] ? toDto(rows[0]) : null;
  });
}

export async function softDeletePlatformContact(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .update(platformContacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(platformContacts.id, id), isNull(platformContacts.deletedAt)))
      .returning({ id: platformContacts.id });
    return rows.length > 0;
  });
}

export async function restorePlatformContact(id: string): Promise<boolean> {
  return withGlobalTenant(async (tx) => {
    const rows = await tx
      .update(platformContacts)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(platformContacts.id, id), isNotNull(platformContacts.deletedAt)))
      .returning({ id: platformContacts.id });
    return rows.length > 0;
  });
}

export async function platformContactsMetrics(): Promise<{
  total: number;
  byKind: Record<string, number>;
  reachableEmail: number;
  reachablePhone: number;
}> {
  return withGlobalTenant(async (tx) => {
    const totals = await tx
      .select({ kind: platformContacts.kind, value: count() })
      .from(platformContacts)
      .where(isNull(platformContacts.deletedAt))
      .groupBy(platformContacts.kind);
    const byKind = Object.fromEntries(totals.map((row) => [row.kind, Number(row.value)]));
    const reachable = await tx
      .select({
        email: count(sql`CASE WHEN email IS NOT NULL AND email <> '' THEN 1 END`),
        phone: count(sql`CASE WHEN phone IS NOT NULL AND phone <> '' THEN 1 END`),
      })
      .from(platformContacts)
      .where(isNull(platformContacts.deletedAt));
    return {
      total: totals.reduce((sum, row) => sum + Number(row.value), 0),
      byKind,
      reachableEmail: Number(reachable[0]?.email ?? 0),
      reachablePhone: Number(reachable[0]?.phone ?? 0),
    };
  });
}
