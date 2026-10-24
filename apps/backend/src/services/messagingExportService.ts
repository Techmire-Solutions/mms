import {
  escapeCsvCell,
  formatDateTime,
  MESSAGING_CSV_EXPORT_MAX_BYTES,
  MESSAGING_CSV_EXPORT_MAX_ROWS,
  type MessagingCsvExportQueryDto,
} from "@mms/shared";
import { loadFilteredMessageLogs, resolveMessagingRecipients } from "./messagingService.js";

const RESOLVE_CHUNK_SIZE = 100;

const CSV_HEADERS = ["Recipient", "Channel", "Category", "Message", "Date Sent"] as const;

export interface MessagingCsvExportOptions {
  filename?: string;
  onProgress?: (current: number, total: number) => void | Promise<void>;
}

export interface MessagingCsvExportResult {
  csv: string;
  filename: string;
  count: number;
}

/** Thrown when export would exceed row or byte caps. */
export class MessagingCsvExportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingCsvExportLimitError";
  }
}

function normalizeFilename(filename?: string): string {
  const trimmed = filename?.trim() || "message_history.csv";
  return trimmed.toLowerCase().endsWith(".csv") ? trimmed : `${trimmed}.csv`;
}

function normalizeFilters(query: MessagingCsvExportQueryDto = {}): MessagingCsvExportQueryDto {
  const channel = query.channel && query.channel !== "all" ? query.channel : undefined;
  const category = query.category && query.category !== "all" ? query.category : undefined;
  const status = query.status && query.status !== "all" ? query.status : undefined;
  const search = query.search?.trim() || undefined;
  const startDate = query.startDate?.trim() || undefined;
  const endDate = query.endDate?.trim() || undefined;
  return { channel, category, status, search, startDate, endDate };
}

/**
 * Streams messaging CSV chunks page-by-page (250 records max per batch)
 * with recipient resolution, yielding CSV chunks without accumulating all logs in memory.
 */
export async function* generateMessagingCsvStreamChunks(
  workspaceSubdomain: string,
  query: MessagingCsvExportQueryDto = {},
  options: MessagingCsvExportOptions = {},
): AsyncGenerator<string, { count: number; filename: string }, undefined> {
  const filters = normalizeFilters(query);
  const filename = normalizeFilename(options.filename);
  const CHUNK_SIZE = 250;

  // Yield header
  yield CSV_HEADERS.map((header) => escapeCsvCell(header)).join(",") + "\n";

  let page = 1;
  let count = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await loadFilteredMessageLogs(workspaceSubdomain, {
      ...filters,
      page,
      pageSize: CHUNK_SIZE,
      includeDeleted: false,
    });

    if (page === 1 && result.total > MESSAGING_CSV_EXPORT_MAX_ROWS) {
      throw new MessagingCsvExportLimitError(
        `Export exceeds maximum of ${MESSAGING_CSV_EXPORT_MAX_ROWS} rows (${result.total} matched)`,
      );
    }

    const logs = result.logs;
    if (logs.length > 0) {
      // Resolve recipient names for this page only
      const uniqueIdSet = new Set<string>();
      for (let i = 0; i < logs.length; i++) {
        uniqueIdSet.add(String(logs[i].contactId));
      }
      const uniqueIds = [...uniqueIdSet];
      const nameById = new Map<string, string>();
      for (let index = 0; index < uniqueIds.length; index += RESOLVE_CHUNK_SIZE) {
        const chunk = uniqueIds.slice(index, index + RESOLVE_CHUNK_SIZE);
        const recipients = await resolveMessagingRecipients(workspaceSubdomain, chunk);
        for (const recipient of recipients) {
          nameById.set(String(recipient.id), recipient.name);
        }
      }

      const lines: string[] = [];
      for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const contactKey = String(log.contactId);
        const name = nameById.get(contactKey) || `Contact #${contactKey}`;
        lines.push(
          [name, log.channel, log.category || "general", log.body, formatDateTime(log.sentAt)]
            .map((cell) => escapeCsvCell(cell))
            .join(","),
        );
      }
      yield lines.join("\n") + "\n";
      count += logs.length;
      if (count > MESSAGING_CSV_EXPORT_MAX_ROWS) {
        throw new MessagingCsvExportLimitError(
          `Export exceeds maximum of ${MESSAGING_CSV_EXPORT_MAX_ROWS} rows`,
        );
      }
    }

    await options.onProgress?.(count, Math.max(result.total, 1));
    hasMore = result.hasMore;
    page += 1;
  }

  return { count, filename };
}

/**
 * Builds a CSV artifact from streaming chunks with byte and row limits.
 */
export async function buildMessagingCsvExport(
  workspaceSubdomain: string,
  query: MessagingCsvExportQueryDto = {},
  options: MessagingCsvExportOptions = {},
): Promise<MessagingCsvExportResult> {
  const generator = generateMessagingCsvStreamChunks(workspaceSubdomain, query, options);
  const chunks: string[] = [];
  let totalBytes = 0;
  let step = await generator.next();

  while (!step.done) {
    const chunk = step.value;
    totalBytes += Buffer.byteLength(chunk, "utf8");
    if (totalBytes > MESSAGING_CSV_EXPORT_MAX_BYTES) {
      throw new MessagingCsvExportLimitError(
        `Export exceeds maximum of ${MESSAGING_CSV_EXPORT_MAX_BYTES} bytes (${totalBytes} generated)`,
      );
    }
    chunks.push(chunk);
    step = await generator.next();
  }

  const meta = step.value;
  // Trim trailing newline to match previous format
  const csv = chunks.join("").replace(/\n$/, "");

  return {
    csv,
    filename: meta?.filename || normalizeFilename(options.filename),
    count: meta?.count ?? 0,
  };
}
