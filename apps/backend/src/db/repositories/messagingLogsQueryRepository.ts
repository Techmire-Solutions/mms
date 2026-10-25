import { and, eq, gte, ilike, isNull, lte, or, sql, desc } from "drizzle-orm";
import { messageLogs } from "../schema.js";
import type { Message } from "@mms/shared";
import { MESSAGE_LOGS_DEFAULT_PAGE_SIZE, toSqlSearchPattern } from "@mms/shared";
import { withTenant } from "../tenant-context.js";
import { logRowToRecord } from "./messagingLogsRepository.js";

/** Matches messagingLogsQuerySchema pageSize max — defensive for direct callers. */
const MESSAGE_LOGS_MAX_PAGE_SIZE = 100;

export interface MessageLogsFilterQuery {
  channel?: string;
  category?: string;
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  sortField?: string;
  sortDir?: "asc" | "desc" | "";
  includeDeleted?: boolean | string;
}

export interface MessageLogsPageResult {
  logs: Message[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** SQL-filtered message log list with pagination + total. */
export async function queryFilteredMessageLogs(
  workspaceSubdomain: string,
  query: MessageLogsFilterQuery = {},
): Promise<MessageLogsPageResult> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  const effectivePageSize =
    query.pageSize && query.pageSize > 0
      ? query.pageSize
      : query.limit && query.limit > 0
        ? query.limit
        : MESSAGE_LOGS_DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(effectivePageSize, MESSAGE_LOGS_MAX_PAGE_SIZE);

  if (!subdomain) {
    return {
      logs: [],
      total: 0,
      page: 1,
      pageSize,
      hasMore: false,
    };
  }

  const includeDeleted = query.includeDeleted === true;
  const page = Math.max(1, query.page ?? 1);
  const offset = (page - 1) * pageSize;

  return withTenant(subdomain, async (tx) => {
    const conditions = [eq(messageLogs.workspaceSubdomain, subdomain)];

    if (!includeDeleted) {
      conditions.push(isNull(messageLogs.deletedAt));
    }

    if (query.channel && query.channel !== "all") {
      conditions.push(eq(messageLogs.channel, query.channel));
    }

    if (query.category && query.category !== "all") {
      conditions.push(eq(messageLogs.category, query.category));
    }

    if (query.status && query.status !== "all") {
      conditions.push(eq(messageLogs.status, query.status));
    }

    if (query.startDate?.trim()) {
      conditions.push(gte(messageLogs.sentAt, query.startDate.trim()));
    }

    if (query.endDate?.trim()) {
      const rawEnd = query.endDate.trim();
      const normalizedEnd = rawEnd.includes("T") ? rawEnd : `${rawEnd}T23:59:59.999Z`;
      conditions.push(lte(messageLogs.sentAt, normalizedEnd));
    }

    if (query.search?.trim()) {
      const s = toSqlSearchPattern(query.search.trim());
      conditions.push(
        or(
          ilike(messageLogs.body, s),
          ilike(messageLogs.subject, s),
          ilike(messageLogs.contactId, s),
          sql`${messageLogs.contactId} IN (
            SELECT id FROM contacts
            WHERE workspace_subdomain = ${subdomain}
              AND deleted_at IS NULL
              AND name ILIKE ${s}
          )`,
        )!,
      );
    }

    const whereClause = and(...conditions);

    const countRows = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(messageLogs)
      .where(whereClause);
    const total = Number(countRows[0]?.count ?? 0);

    const rows = await tx
      .select({
        id: messageLogs.id,
        workspaceSubdomain: messageLogs.workspaceSubdomain,
        userId: messageLogs.userId,
        contactId: messageLogs.contactId,
        channel: messageLogs.channel,
        body: messageLogs.body,
        sentAt: messageLogs.sentAt,
        status: messageLogs.status,
        subject: messageLogs.subject,
        category: messageLogs.category,
        errorMessage: messageLogs.errorMessage,
        deletedAt: messageLogs.deletedAt,
        deletedBy: messageLogs.deletedBy,
        deletionReason: messageLogs.deletionReason,
        createdAt: messageLogs.createdAt,
        updatedAt: messageLogs.updatedAt,
      })
      .from(messageLogs)
      .where(whereClause)
      .orderBy(desc(messageLogs.sentAt), desc(messageLogs.id))
      .limit(pageSize)
      .offset(offset);

    const logs = rows.map(logRowToRecord);

    return {
      logs,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  });
}

export interface MessagingMetricsFilterQuery {
  startDate?: string;
  endDate?: string;
}

/** SQL aggregate metrics for active (non-archived) message logs. */
export async function queryMessagingMetrics(
  workspaceSubdomain: string,
  filters: MessagingMetricsFilterQuery = {},
): Promise<{
  total: number;
  smsCount: number;
  whatsappCount: number;
  emailCount: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  queuedCount: number;
  successRate: number;
  categoryBreakdown: Record<string, number>;
}> {
  const subdomain = workspaceSubdomain?.trim().toLowerCase();
  if (!subdomain) {
    return {
      total: 0,
      smsCount: 0,
      whatsappCount: 0,
      emailCount: 0,
      sentCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      skippedCount: 0,
      queuedCount: 0,
      successRate: 100,
      categoryBreakdown: {
        general: 0,
        academic: 0,
        financial: 0,
        attendance: 0,
        emergency: 0,
      },
    };
  }
  const startDate = filters.startDate?.trim() || null;
  const rawEnd = filters.endDate?.trim() || null;
  const endDate = rawEnd ? (rawEnd.includes("T") ? rawEnd : `${rawEnd}T23:59:59.999Z`) : null;
  return withTenant(subdomain, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE channel = 'sms')::int AS sms_count,
        COUNT(*) FILTER (WHERE channel = 'whatsapp')::int AS whatsapp_count,
        COUNT(*) FILTER (WHERE channel = 'email')::int AS email_count,
        COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
        COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count,
        COUNT(*) FILTER (WHERE status = 'queued')::int AS queued_count,
        COUNT(*) FILTER (WHERE category = 'general')::int AS cat_general,
        COUNT(*) FILTER (WHERE category = 'academic')::int AS cat_academic,
        COUNT(*) FILTER (WHERE category = 'financial')::int AS cat_financial,
        COUNT(*) FILTER (WHERE category = 'attendance')::int AS cat_attendance,
        COUNT(*) FILTER (WHERE category = 'emergency')::int AS cat_emergency
      FROM message_logs
      WHERE workspace_subdomain = ${subdomain}
        AND deleted_at IS NULL
        AND (
          ${startDate}::text IS NULL
          OR sent_at >= ${startDate}
        )
        AND (
          ${endDate}::text IS NULL
          OR sent_at <= ${endDate}
        )
    `);

    const rows = ((result as { rows?: Record<string, unknown>[] }).rows ??
      (Array.isArray(result) ? result : [])) as Record<string, unknown>[];
    const row = (Array.isArray(rows) ? rows[0] : {}) ?? {};

    const num = (key: string): number => Number(row[key] ?? 0) || 0;
    const total = num("total");
    const sentCount = num("sent_count");
    const deliveredCount = num("delivered_count");
    const successfulTotal = sentCount + deliveredCount;

    return {
      total,
      smsCount: num("sms_count"),
      whatsappCount: num("whatsapp_count"),
      emailCount: num("email_count"),
      sentCount,
      deliveredCount,
      failedCount: num("failed_count"),
      skippedCount: num("skipped_count"),
      queuedCount: num("queued_count"),
      successRate: total > 0 ? Math.round((successfulTotal / total) * 100) : 100,
      categoryBreakdown: {
        general: num("cat_general"),
        academic: num("cat_academic"),
        financial: num("cat_financial"),
        attendance: num("cat_attendance"),
        emergency: num("cat_emergency"),
      },
    };
  });
}
