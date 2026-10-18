import {
  CONTACTS_MODULE_MANIFEST,
  buildContactsExportRows,
  buildCsvContent,
  compileContactColumnExtractor,
  filterContactExportColumnsForViewer,
  resolveContactFieldConfigSnapshot,
  sanitizeContactsForViewer,
  toVCard,
  type Contact,
  type ContactExportColumn,
  type ContactsListQuery,
  type FieldConfig,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "../../lib/createModuleExportService.js";
import {
  CsvExportLimitError,
  normalizeIncludeDeletedFlag,
} from "../../lib/csvExportStreamFactory.js";
import { loadContactsByIds, loadContactsPage } from "./contactLoadUseCases.js";
import { loadContactFieldConfig } from "./contactConfigService.js";

const EXPORT_LABELS = { yes: "Yes", no: "No" };

type ContactsExportQueryInput = Omit<ContactsListQuery, "includeDeleted"> & {
  includeDeleted?: ContactsListQuery["includeDeleted"] | "true" | "false";
};

export type { ContactsExportQueryInput };
export type ContactsExportOptions = ModuleExportOptions<ContactExportColumn>;
export type ContactsExportResult = ModuleExportResult;
export type ContactsCsvExportOptions = ContactsExportOptions;
export type ContactsCsvExportResult = ContactsExportResult;

type ContactsExportContext = {
  viewerRole: string;
  fieldConfig: FieldConfig | null;
};

async function prepareContactsExport(
  options: ContactsExportOptions,
): Promise<{ columns: ContactExportColumn[]; context: ContactsExportContext }> {
  const requestedColumns = options.columns && options.columns.length > 0 ? options.columns : [];
  const config = await loadContactFieldConfig();
  const fieldConfig: FieldConfig | null = config?.fields
    ? config.formTabs
      ? config
      : { ...config, formTabs: [], enabledTabs: [], requiredTabs: [], version: config.version ?? 1 }
    : null;
  const columns = filterContactExportColumnsForViewer(
    requestedColumns,
    fieldConfig,
    options.viewerRole,
  );
  return {
    columns,
    context: { viewerRole: options.viewerRole, fieldConfig },
  };
}

const contactsCsv = createModuleExportService<
  Contact,
  ContactsExportQueryInput,
  ContactExportColumn,
  ContactsExportContext
>({
  manifest: CONTACTS_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: prepareContactsExport,
  loadByIds: loadContactsByIds,
  loadPage: async (query, page, limit, afterId) => {
    const pageResult = await loadContactsPage({
      ...query,
      page,
      limit,
      afterId,
      skipCount: true,
      fullHydration: true,
    } as never);
    return {
      rows: pageResult.contacts as Contact[],
      hasMore: pageResult.hasMore,
      nextCursor: (pageResult as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (contacts, columns, chunkSize, context) => {
    // Always sanitize: an absent tenant config falls back to the default seed rather than
    // skipping viewer restrictions entirely.
    const sanitizeSnapshot = resolveContactFieldConfigSnapshot(context.fieldConfig);

    function* gen(): Generator<string, void, undefined> {
      for (let i = 0; i < contacts.length; i += chunkSize) {
        const chunk = contacts.slice(i, i + chunkSize);
        const sanitizedChunk = sanitizeContactsForViewer(
          chunk,
          context.viewerRole,
          sanitizeSnapshot,
        );
        const chunkExportRows = buildContactsExportRows(sanitizedChunk, columns, EXPORT_LABELS);
        const dataRows = chunkExportRows.slice(1);
        if (dataRows.length > 0) {
          yield "\n" + buildCsvContent(dataRows);
        }
      }
    }
    return gen();
  },
  extractCell: (contact, columnId) =>
    compileContactColumnExtractor(columnId, EXPORT_LABELS)(contact),
});

export const generateContactsCsvStreamChunks = contactsCsv.generateStreamChunks;
export const buildContactsCsvExport = contactsCsv.buildExport as (
  query: ContactsExportQueryInput,
  options: ContactsExportOptions,
) => Promise<ContactsExportResult>;

const VCF_PAGE_SIZE = 500;

export interface ContactsVcfExportResult {
  vcf: string;
  filename: string;
  count: number;
}

/**
 * Streams a tenant VCF export page-by-page as chunk strings.
 */
export async function* generateContactsVcfStreamChunks(options?: {
  filename?: string;
  chunkSize?: number;
  onProgress?: (processed: number, total: number) => void | Promise<void>;
}): AsyncGenerator<string, { count: number; filename: string }, undefined> {
  const filename = options?.filename?.trim() || "contacts.vcf";
  const limit = Math.max(1, options?.chunkSize ?? VCF_PAGE_SIZE);
  let page = 1;
  let count = 0;

  for (;;) {
    const pageResult = await loadContactsPage({
      page,
      limit,
      includeDeleted: false,
    } as never);
    const contacts = pageResult.contacts as Contact[];
    if (contacts.length > 0) {
      const chunk = contacts.map(toVCard).join("\r\n");
      yield count === 0 ? chunk : "\r\n" + chunk;
      count += contacts.length;
    }
    await options?.onProgress?.(count, pageResult.total);
    if (!pageResult.hasMore) {
      return { count, filename };
    }
    page += 1;
  }
}

/**
 * Builds a tenant VCF export by SQL-paginating contacts (no full-list hydrate).
 */
export async function buildContactsVcfExport(options?: {
  filename?: string;
  chunkSize?: number;
  maxRecords?: number;
  onProgress?: (processed: number, total: number) => void | Promise<void>;
}): Promise<ContactsVcfExportResult> {
  const maxRecords = options?.maxRecords ?? 500;
  const generator = generateContactsVcfStreamChunks(options);
  const chunks: string[] = [];
  let step = await generator.next();
  while (!step.done) {
    chunks.push(step.value);
    step = await generator.next();
  }
  const meta = step.value;
  if (meta && meta.count > maxRecords) {
    throw new CsvExportLimitError(
      `VCF export exceeds in-memory cap of ${maxRecords} records (${meta.count} records). Use streaming export instead.`,
    );
  }
  return {
    vcf: chunks.join(""),
    filename: meta?.filename || options?.filename?.trim() || "contacts.vcf",
    count: meta?.count ?? 0,
  };
}
