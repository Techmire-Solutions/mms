import { and, eq, inArray, sql } from "drizzle-orm";
import { formatArchivedSystemTag, normalizeContactTagName, systemTagBaseName } from "@mms/shared";
import { logger } from "../../lib/logger.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { contactRelationships, contactTags, contacts } from "../../db/schema.js";
import { withTenant, type TenantTransaction } from "../../db/tenant-context.js";
import { invalidateMultiTierCache } from "../../lib/cache/index.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import {
  chunk,
  computeStudentDesiredTags,
  type DesiredSystemTag,
} from "./contactSystemTagCompute.js";
import { computeFacultyDesiredTags } from "./contactSystemTagFacultyCompute.js";

function baseTagName(name: string): string {
  return normalizeContactTagName(systemTagBaseName(name));
}

/**
 * Keeps one desired tag per visible role name. Two active designations with the
 * same name must not create two identical tag rows (the DB enforces that too).
 */
function collapseDesiredByTagName(
  desired: Map<string, DesiredSystemTag>,
): Map<string, DesiredSystemTag> {
  const chosen = new Map<string, DesiredSystemTag>();
  for (const tag of desired.values()) {
    const normalized = baseTagName(tag.name);
    const current = chosen.get(normalized);
    if (
      !current ||
      (current.archived && !tag.archived) ||
      (current.archived === tag.archived && tag.systemKey < current.systemKey)
    ) {
      chosen.set(normalized, tag);
    }
  }
  return new Map([...chosen.values()].map((tag) => [tag.systemKey, tag]));
}

/** Unit tests mock the DB boundary with an empty transaction object. */
function canQuery(tx: TenantTransaction): boolean {
  const candidate = tx as unknown as { select?: unknown; execute?: unknown };
  return typeof candidate.select === "function" && typeof candidate.execute === "function";
}

async function loadWorkspaceToday(tx: TenantTransaction, subdomain: string): Promise<string> {
  const result = await tx.execute<{ today: string }>(sql`
    SELECT to_char(
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(w.timezone, ''), 'UTC'))::date,
      'YYYY-MM-DD'
    ) AS today
    FROM workspaces w
    WHERE w.subdomain = ${subdomain}
    LIMIT 1
  `);
  const rows = (result as unknown as { rows?: Array<{ today: string }> }).rows ?? [];
  return rows[0]?.today ?? new Date().toISOString().slice(0, 10);
}

interface ExistingTagRow {
  id: string;
  contactId: string;
  name: string;
  source: string | null;
  systemKey: string | null;
  archived: boolean;
}

async function loadExistingTags(
  tx: TenantTransaction,
  subdomain: string,
  contactIds: string[],
): Promise<ExistingTagRow[]> {
  return (await tx
    .select({
      id: contactTags.id,
      contactId: contactTags.contactId,
      name: contactTags.name,
      source: contactTags.source,
      systemKey: contactTags.systemKey,
      archived: contactTags.archived,
    })
    .from(contactTags)
    .where(
      and(
        eq(contactTags.workspaceSubdomain, subdomain),
        inArray(contactTags.contactId, contactIds),
      ),
    )) as ExistingTagRow[];
}

/**
 * Reconciles module-managed tags for the given contacts.
 *
 * System rows are never deleted: a role that no longer exists is archived
 * (`Former …`), which is what makes an explicit unlink historical rather than
 * destructive. Manual tags with a colliding name are converted in place.
 */
export async function reconcileContactSystemTags(
  tenant: string,
  contactIds: Array<string | number | null | undefined>,
  options?: { actorId?: string; touchContacts?: boolean },
): Promise<number> {
  const subdomain = tenant.trim().toLowerCase();
  const rootIds = Array.from(
    new Set(contactIds.map((id) => (id == null ? "" : String(id).trim())).filter(Boolean)),
  );
  if (rootIds.length === 0) return 0;

  // A student's Parent/Guardian tags live on the primary contact's relationship
  // graph, so a student write must also reconcile that student's related contacts.
  const relatedRows = await withTenant(subdomain, (tx) => {
    if (!canQuery(tx)) return Promise.resolve([] as Array<{ relatedContactId: string | null }>);
    return tx
      .select({ relatedContactId: contactRelationships.relatedContactId })
      .from(contactRelationships)
      .where(
        and(
          eq(contactRelationships.workspaceSubdomain, subdomain),
          inArray(contactRelationships.contactId, rootIds),
        ),
      );
  });
  const ids = Array.from(
    new Set([
      ...rootIds,
      ...relatedRows.map((row) => row.relatedContactId).filter((id): id is string => Boolean(id)),
    ]),
  );

  let changedContacts = 0;
  for (const batch of chunk(ids)) {
    changedContacts += await withTenant(subdomain, async (tx) => {
      if (!canQuery(tx)) return 0;
      // Serialize competing reconciles for the same contact so two writers cannot
      // both insert the same system key/name and hit the unique indexes.
      for (const contactId of [...batch].sort()) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`contact-system-tags:${subdomain}:${contactId}`}))`,
        );
      }
      const today = await loadWorkspaceToday(tx, subdomain);
      const [studentTags, facultyTags, existing] = await Promise.all([
        computeStudentDesiredTags(tx, subdomain, batch),
        computeFacultyDesiredTags(tx, subdomain, batch, today),
        loadExistingTags(tx, subdomain, batch),
      ]);

      const changed = new Set<string>();
      const now = new Date();
      for (const contactId of batch) {
        const desired = collapseDesiredByTagName(
          new Map<string, DesiredSystemTag>([
            ...(studentTags.get(contactId) ?? new Map<string, DesiredSystemTag>()),
            ...(facultyTags.get(contactId) ?? new Map<string, DesiredSystemTag>()),
          ]),
        );
        const desiredNames = new Set([...desired.values()].map((tag) => baseTagName(tag.name)));
        const rows = existing.filter((row) => row.contactId === contactId);
        const byKey = new Map(
          rows.filter((row) => row.systemKey).map((row) => [row.systemKey!, row]),
        );

        for (const [key, tag] of desired) {
          // A key may have changed when same-named designations collapsed; match
          // the existing row by its visible (base) name as well as by key.
          const current =
            byKey.get(key) ?? rows.find((row) => baseTagName(row.name) === baseTagName(tag.name));
          if (current) {
            if (
              current.name !== tag.name ||
              current.archived !== tag.archived ||
              current.source !== tag.source ||
              current.systemKey !== tag.systemKey
            ) {
              await tx
                .update(contactTags)
                .set({
                  name: tag.name,
                  source: tag.source,
                  systemKey: tag.systemKey,
                  archived: tag.archived,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(contactTags.workspaceSubdomain, subdomain),
                    eq(contactTags.contactId, contactId),
                    eq(contactTags.id, current.id),
                  ),
                );
              changed.add(contactId);
            }
            continue;
          }

          await tx.insert(contactTags).values({
            id: `sys-${crypto.randomUUID()}`,
            workspaceSubdomain: subdomain,
            contactId,
            name: tag.name,
            source: tag.source,
            systemKey: tag.systemKey,
            archived: tag.archived,
            updatedAt: now,
          });
          changed.add(contactId);
        }

        // Existing system tags with no desired source become archived, never deleted.
        for (const row of rows) {
          if (!row.systemKey) continue;
          if (desired.has(row.systemKey) || desiredNames.has(baseTagName(row.name))) continue;
          if (row.archived) continue;
          await tx
            .update(contactTags)
            .set({
              name: formatArchivedSystemTag(row.name),
              archived: true,
              updatedAt: now,
            })
            .where(
              and(
                eq(contactTags.workspaceSubdomain, subdomain),
                eq(contactTags.contactId, contactId),
                eq(contactTags.id, row.id),
              ),
            );
          changed.add(contactId);
        }
      }

      if (changed.size > 0 && options?.touchContacts !== false) {
        await tx
          .update(contacts)
          .set({ updatedAt: now, ...(options?.actorId ? { updatedBy: options.actorId } : {}) })
          .where(
            and(eq(contacts.workspaceSubdomain, subdomain), inArray(contacts.id, [...changed])),
          );
      }
      return changed.size;
    });
  }

  if (changedContacts > 0) {
    await invalidateMultiTierCache({ tenantId: subdomain, domain: "contacts" });
    await broadcastCollection("contacts");
    if (options?.actorId) {
      await recordModernAuditEvent({
        workspaceSubdomain: subdomain,
        tableName: "contacts",
        recordId: "system-tags",
        actionType: "UPDATE",
        realUserId: options.actorId,
        newState: {
          action: "contact.system_tags",
          summary: `Reconciled module role tags for ${changedContacts} contact(s)`,
        },
      }).catch((error: unknown) => {
        logger.error(
          {
            err: error instanceof Error ? error.message : String(error),
            tenant: subdomain,
          },
          "System tag audit append failed",
        );
      });
    }
  }
  return changedContacts;
}
