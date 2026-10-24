import {
  type Contact,
  type ContactsDuplicatePairsPageResult,
  type ContactsListQuery,
  type ContactsListPageResult,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { loadDuplicatePairsPage } from "./contactDuplicateScanUseCases.js";
import type { ContactsRepository } from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

/** Active (or deleted-only) contact count via SQL — avoids loading every row. */
export async function countContacts(
  options?: { includeDeleted?: boolean },
  repo: ContactsRepository = contactsRepository,
): Promise<number> {
  const tenant = getRequestTenant();
  if (!tenant) return 0;
  const deleted = options?.includeDeleted ? "deleted" : "active";
  return repo.countByWorkspace(tenant, { deleted });
}

export async function loadContactsPage(
  query: ContactsListQuery,
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsListPageResult> {
  const tenant = getRequestTenant();
  if (!tenant) {
    return {
      contacts: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      hasMore: false,
    };
  }
  return repo.listPage(tenant, query);
}

export async function loadContactsByIds(
  ids: string[],
  repo: ContactsRepository = contactsRepository,
): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return loadContactsByIdsForTenant(tenant, ids, repo);
}

/** Tenant-parameterized variant for cross-module services (e.g. Messaging recipients). */
export async function loadContactsByIdsForTenant(
  tenant: string,
  ids: string[],
  repo: ContactsRepository = contactsRepository,
): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const matched = await repo.findByIds(tenant, ids);
  return matched.filter((contact) => !contact.deletedAt);
}

/** Lean variant fetching only summary fields + relationships (bypasses heavy subcollections). */
export async function loadContactsSummaryByIdsForTenant(
  tenant: string,
  ids: string[],
  repo: ContactsRepository = contactsRepository,
): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const fetchFn = repo.findSummaryByIds
    ? repo.findSummaryByIds.bind(repo)
    : repo.findByIds.bind(repo);
  const matched = await fetchFn(tenant, ids);
  return matched.filter((contact) => !contact.deletedAt);
}

export async function loadContactsPageForTenant(
  tenant: string,
  query: ContactsListQuery,
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsListPageResult> {
  return repo.listPage(tenant, query);
}

export async function loadContactDuplicatePairsPage(
  query: { page?: number; limit?: number },
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsDuplicatePairsPageResult> {
  return loadDuplicatePairsPage(query, repo);
}

/** Existing normalized contact names (Google sync dedupe) via SQL — no full-set hydrate. */
export async function loadExistingNormalizedContactNames(
  names: string[],
  repo: ContactsRepository = contactsRepository,
): Promise<Set<string>> {
  const tenant = getRequestTenant();
  if (!tenant || names.length === 0) return new Set<string>();
  return repo.findExistingNormalizedContactNames(tenant, names);
}

/** Active contacts matching candidate phone numbers, emails, or scalar fields (for dedupe & sync). */
export async function findContactsMatchingUniqueValues(
  values: {
    phoneDigits?: string[];
    emails?: string[];
    scalars?: Array<{ fieldKey: string; normalized: string }>;
  },
  excludeIds: Array<string | number> = [],
  repo: ContactsRepository = contactsRepository,
): Promise<Contact[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return repo.findActiveContactsMatchingUniqueValues(
    tenant,
    {
      phoneDigits: values.phoneDigits ?? [],
      emails: values.emails ?? [],
      scalars: values.scalars ?? [],
    },
    excludeIds,
  );
}

export async function getContactById(
  id: string,
  includeDeleted = false,
  repo: ContactsRepository = contactsRepository,
): Promise<Contact | null> {
  const tenant = getRequestTenant();
  if (!tenant) return null;
  const found = await repo.findById(tenant, id);
  if (!found) return null;
  if (!includeDeleted && found.deletedAt) return null;
  return found;
}

export {
  type ContactRuntimeDefaults,
  resolveDefaultPhoneCountryCode,
  loadContactRuntimeDefaults,
} from "./contactRuntimeDefaults.js";

export {
  loadContactsCommandMetrics,
  loadContactsReportAnalytics,
  loadContactsWidgetAggregates,
} from "./contactAnalyticsUseCases.js";
