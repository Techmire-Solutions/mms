import type { FastifyReply, FastifyRequest } from "fastify";
import {
  isQueryFlagTrue,
  type User,
  CONTACTS_MODULE_MANIFEST,
  STUDENTS_MODULE_MANIFEST,
  FACULTY_MODULE_MANIFEST,
  SESSIONS_MODULE_MANIFEST,
  ENROLLMENTS_MODULE_MANIFEST,
  ATTENDANCE_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  ACCOUNTING_MODULE_MANIFEST,
  OBLIGATIONS_MODULE_MANIFEST,
  HASANAT_MODULE_MANIFEST,
  EXAMINATIONS_MODULE_MANIFEST,
  QUESTION_BANK_MODULE_MANIFEST,
  USERS_MODULE_MANIFEST,
  MESSAGING_MODULE_MANIFEST,
  LIST_PAGE_MAX_LIMIT,
} from "@mms/shared";
import { canDeleteCollection, canReadCollection } from "./rbacCanHelpers.js";
import { sendForbidden, sendDatabaseError } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { includeDeletedQuerySchema } from "@mms/shared";
import { sql } from "drizzle-orm";
import { withTenant } from "../db/tenant-context.js";
import { getRequestTenant } from "./tenantContext.js";
import type { BulkListLoadContext } from "./crudBulkRouteTypes.js";

// Option shapes live in their own module (ADR-001 line bands); re-exported so the
// public surface of this file is unchanged for consumers.
export type {
  BulkListLoadContext,
  BulkRoutesOptions,
  SoftDeleteRouteErrorMapper,
  SoftDeletableBulkRoutesOptions,
  SoftDeletableBulkTrashRoutesOptions,
} from "./crudBulkRouteTypes.js";

const MANIFESTS_BY_COLLECTION: Record<
  string,
  { softDelete?: { captureDeletionReason?: boolean } }
> = {
  contacts: CONTACTS_MODULE_MANIFEST,
  students: STUDENTS_MODULE_MANIFEST,
  faculty: FACULTY_MODULE_MANIFEST,
  sessions: SESSIONS_MODULE_MANIFEST,
  enrollments: ENROLLMENTS_MODULE_MANIFEST,
  attendance: ATTENDANCE_MODULE_MANIFEST,
  attendance_records: ATTENDANCE_MODULE_MANIFEST,
  finance: FINANCE_MODULE_MANIFEST,
  finance_invoices: FINANCE_MODULE_MANIFEST,
  finance_payments: FINANCE_MODULE_MANIFEST,
  accounting: ACCOUNTING_MODULE_MANIFEST,
  accounting_entries: ACCOUNTING_MODULE_MANIFEST,
  accounting_accounts: ACCOUNTING_MODULE_MANIFEST,
  obligations: OBLIGATIONS_MODULE_MANIFEST,
  obligation_collections: OBLIGATIONS_MODULE_MANIFEST,
  obligation_types: OBLIGATIONS_MODULE_MANIFEST,
  obligation_distributions: OBLIGATIONS_MODULE_MANIFEST,
  hasanat: HASANAT_MODULE_MANIFEST,
  hasanat_distributions: HASANAT_MODULE_MANIFEST,
  examinations: EXAMINATIONS_MODULE_MANIFEST,
  exams: EXAMINATIONS_MODULE_MANIFEST,
  exam_results: EXAMINATIONS_MODULE_MANIFEST,
  question_bank: QUESTION_BANK_MODULE_MANIFEST,
  questionBank: QUESTION_BANK_MODULE_MANIFEST,
  questions: QUESTION_BANK_MODULE_MANIFEST,
  tests: QUESTION_BANK_MODULE_MANIFEST,
  users: USERS_MODULE_MANIFEST,
  messaging: MESSAGING_MODULE_MANIFEST,
  messages: MESSAGING_MODULE_MANIFEST,
  message_logs: MESSAGING_MODULE_MANIFEST,
  message_templates: MESSAGING_MODULE_MANIFEST,
};

/**
 * Returns whether a collection should capture deletion reason based on its module manifest,
 * unless explicitly overridden by options.
 */
export function shouldCaptureDeletionReason(
  collection?: string,
  explicitOption?: boolean,
): boolean {
  if (explicitOption !== undefined) return explicitOption;
  if (!collection) return true;
  const manifest = MANIFESTS_BY_COLLECTION[collection];
  if (manifest?.softDelete?.captureDeletionReason !== undefined) {
    return manifest.softDelete.captureDeletionReason;
  }
  return true;
}

/**
 * Parses a positive integer query param, falling back on NaN/0/negative and
 * clamping to `max` so a caller cannot request an unbounded page size.
 */
function parseClampedInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function handleBulkListGet(
  request: FastifyRequest,
  reply: FastifyReply,
  user: User,
  collection: string,
  ctx: BulkListLoadContext,
): Promise<unknown> {
  if (!canReadCollection(user, collection)) return sendForbidden(reply);

  const {
    loadFn,
    loadPageFn,
    listQuerySchema,
    defaultPageSize,
    responseKey,
    errorMessagePrefix,
    supportsIncludeDeleted,
    canDelete = (u: User) => canDeleteCollection(u, collection),
  } = ctx;

  try {
    let pageQuery: Record<string, unknown> | undefined;
    let includeDeleted: boolean | undefined;

    if (listQuerySchema) {
      const parsed = parseRequest(listQuerySchema, request.query);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      const query = parsed.data as Record<string, unknown>;
      if (supportsIncludeDeleted || query.includeDeleted !== undefined) {
        includeDeleted = isQueryFlagTrue(
          query.includeDeleted !== undefined
            ? query.includeDeleted
            : (request.query as Record<string, unknown>)?.includeDeleted,
        );
      }
      if (query.page != null && loadPageFn) pageQuery = query;
    } else if (supportsIncludeDeleted) {
      const parsed = parseRequest(includeDeletedQuerySchema, request.query);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      includeDeleted = isQueryFlagTrue(parsed.data.includeDeleted);
    } else {
      const query = request.query as Record<string, unknown> | undefined;
      if (query?.includeDeleted !== undefined) {
        includeDeleted = isQueryFlagTrue(query.includeDeleted);
      }
    }

    if (includeDeleted && !canDelete(user)) {
      return sendForbidden(
        reply,
        `Viewing deleted ${errorMessagePrefix} requires delete permissions`,
      );
    }

    const runInScope = async <R>(fn: () => Promise<R>): Promise<R> => {
      if (!includeDeleted) return fn();
      const tenant = getRequestTenant() ?? user.workspaceSubdomain;
      return withTenant(tenant, async (tx) => {
        if (tx && typeof tx.execute === "function") {
          await tx.execute(sql`SET LOCAL app.include_deleted = 'true'`);
        }
        return fn();
      });
    };

    if (pageQuery && loadPageFn) {
      const data = await runInScope(() =>
        loadPageFn({
          ...pageQuery,
          limit: Math.min(
            Number(pageQuery.limit ?? defaultPageSize ?? 50) || 50,
            LIST_PAGE_MAX_LIMIT,
          ),
          ...(supportsIncludeDeleted ? { includeDeleted } : {}),
        }),
      );
      return reply.send(data);
    }

    if (!listQuerySchema) {
      const queryParams = request.query as Record<string, string>;
      const isPaginated = !!(queryParams.page || queryParams.limit || queryParams.sortField);
      if (isPaginated && loadPageFn) {
        // Clamp + NaN-guard: these values come straight off the query string
        // (no schema on this path), so `?limit=999999` previously reached the DB.
        const page = parseClampedInt(queryParams.page, 1, Number.MAX_SAFE_INTEGER);
        const limit = parseClampedInt(queryParams.limit, 50, LIST_PAGE_MAX_LIMIT);
        const data = await runInScope(() =>
          loadPageFn({
            page,
            limit,
            search: queryParams.search,
            sortField: queryParams.sortField,
            sortDir: queryParams.sortDir as "asc" | "desc",
            ...(supportsIncludeDeleted ? { includeDeleted } : {}),
          }),
        );
        return reply.send(data);
      }
    }

    if (!loadFn) {
      return sendDatabaseError(reply, `Failed to load ${errorMessagePrefix}`);
    }

    const data = supportsIncludeDeleted
      ? await runInScope(() =>
          (loadFn as (options?: { includeDeleted?: boolean }) => Promise<unknown>)({
            includeDeleted,
          }),
        )
      : await loadFn();
    return reply.send({ [responseKey]: data });
  } catch (error: unknown) {
    if (supportsIncludeDeleted) {
      return sendDatabaseError(reply, `Failed to load ${errorMessagePrefix}`, error);
    }
    return sendDatabaseError(reply, `Failed to load ${errorMessagePrefix}`);
  }
}
