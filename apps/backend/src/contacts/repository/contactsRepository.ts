import type {
  Contact,
  ContactsCommandMetricsSnapshot,
  ContactsListPageResult,
  ContactsListQuery,
  ContactsMonthlyYearCounts,
  ContactsReportAnalyticsSnapshot,
  ContactsWidgetAggregateResult,
  ContactsWidgetQuery,
  FieldConfig,
} from "@mms/shared";
import type {
  ContactDuplicateCandidateKeys,
  ContactUniqueLookupValues,
} from "../../db/repositories/contactRepository.js";

import type { SoftDeleteListFilter } from "../../services/genericRelationalService.js";

/** Duplicate-scan key shape — re-exported from the module interface so use cases never import the db layer. */
export type { ContactDuplicateCandidateKeys, ContactUniqueLookupValues };

/** Soft-delete visibility filter shared by list/count repository reads. */
export type ContactDeletedFilter = SoftDeleteListFilter;

export interface ListContactsOptions {
  deleted?: ContactDeletedFilter;
}

export interface ContactsCommandMetricsOptions {
  periodDays?: number;
  duplicatePairCount?: number;
}

export interface ContactsReportAnalyticsOptions {
  periodDays?: number;
  referenceDate?: Date;
}

/**
 * Sole gateway to contact storage.
 *
 * Use cases depend on this interface — never on concrete Drizzle functions —
 * so persistence can be swapped (tests, future data source) without touching
 * domain orchestration. The Drizzle implementation lives in
 * `contactsRepositoryAdapter.ts`.
 */
export interface ContactsRepository {
  countByWorkspace(tenant: string, options?: ListContactsOptions): Promise<number>;
  listPage(
    tenant: string,
    query: ContactsListQuery & { afterId?: string; skipCount?: boolean },
  ): Promise<ContactsListPageResult & { nextCursor?: string }>;
  findById(tenant: string, id: string): Promise<Contact | null>;
  findByIds(tenant: string, ids: string[]): Promise<Contact[]>;
  findSummaryByIds?(tenant: string, ids: string[]): Promise<Contact[]>;
  save(tenant: string, contact: Contact): Promise<void>;
  bulkSave(tenant: string, contacts: Contact[]): Promise<void>;
  bulkSoftDelete?(
    tenant: string,
    ids: string[],
    deletedBy?: string,
    deletionReason?: string,
  ): Promise<{ succeeded: number; failed: number }>;
  bulkRestore?(
    tenant: string,
    ids: string[],
    userId?: string,
  ): Promise<{ succeeded: number; failed: number }>;

  findExistingNormalizedContactNames(tenant: string, names: string[]): Promise<Set<string>>;
  findActiveContactsMatchingUniqueValues(
    tenant: string,
    values: ContactUniqueLookupValues,
    excludeIds?: Array<string | number>,
  ): Promise<Contact[]>;
  findContactDuplicateCandidateIds(
    tenant: string,
    keys: ContactDuplicateCandidateKeys,
    excludeIds?: Array<string | number>,
  ): Promise<string[]>;
  findContactDuplicateBlockedIds(tenant: string, namePrefixes: string[]): Promise<string[]>;
  reparentContactReferences(tenant: string, keepId: string, deleteId: string): Promise<void>;
  /** Take transaction-scoped advisory locks on normalized unique values (TOCTOU guard). */
  acquireUniqueValueLocks(tenant: string, lockKeys: string[]): Promise<void>;

  aggregateCommandMetrics(
    tenant: string,
    fieldConfig: FieldConfig,
    options?: ContactsCommandMetricsOptions,
  ): Promise<ContactsCommandMetricsSnapshot>;
  aggregateReportAnalytics(
    tenant: string,
    options?: ContactsReportAnalyticsOptions,
  ): Promise<ContactsReportAnalyticsSnapshot>;
  aggregateMonthlyCreatedCounts(
    tenant: string,
    years: number[],
    monthCount?: number,
    language?: string,
  ): Promise<ContactsMonthlyYearCounts[]>;
  aggregateWidgetQueries(
    tenant: string,
    queries: ContactsWidgetQuery[],
  ): Promise<Record<string, ContactsWidgetAggregateResult>>;
  guardDeleteDependents?(tenant: string, ids: string[]): Promise<void>;
}
