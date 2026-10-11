import {
  findContactDuplicatePairs,
  getContactDuplicateCandidateKeys,
  paginateContactDuplicatePairs,
  CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
  type Contact,
  type ContactDuplicatePair,
  type ContactPreferences,
  type ContactsDuplicatePairsPageResult,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { deleteObject, getObject, saveObject } from "../../db/database.js";
import { loadContactPreferences } from "./contactPreferencesService.js";
import type {
  ContactDuplicateCandidateKeys,
  ContactsRepository,
} from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

const CACHE_KEY = CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY;

interface ContactDuplicateScanCache {
  computedAt: string;
  contactCount: number;
  pairCount: number;
  pairs: ContactDuplicatePair[];
}

/** Active contact ids sharing any normalized duplicate key with the candidate. */
export async function loadContactDuplicateCandidateIds(
  keys: ContactDuplicateCandidateKeys,
  excludeIds: Array<string | number> = [],
  repo: ContactsRepository = contactsRepository,
): Promise<string[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return repo.findContactDuplicateCandidateIds(tenant, keys, excludeIds);
}

/** Distinct active contact ids that could participate in any duplicate pair. */
export async function loadContactDuplicateBlockedIds(
  namePrefixes: string[],
  repo: ContactsRepository = contactsRepository,
): Promise<string[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  return repo.findContactDuplicateBlockedIds(tenant, namePrefixes);
}

/**
 * Pair-finding over only the SQL-blocked participant set.
 *
 * SQL returns the distinct ids that share a normalized phone/email/name key with
 * at least one other active contact (`findContactDuplicateBlockedIds`); we
 * hydrate exactly those and run the shared pair-finder — never the full active set.
 */
async function findBlockedDuplicatePairs(
  preferences: ContactPreferences | null,
  repo: ContactsRepository,
): Promise<ContactDuplicatePair[]> {
  const tenant = getRequestTenant();
  if (!tenant) return [];
  const blockedIds = await loadContactDuplicateBlockedIds(
    preferences?.namePrefixesToIgnore ?? [],
    repo,
  );
  if (blockedIds.length === 0) return [];
  const pool = await repo.findByIds(tenant, blockedIds);
  return findContactDuplicatePairs(
    pool.filter((contact) => !contact.deletedAt),
    preferences ?? {},
  );
}

export async function getDuplicateScanCache(): Promise<ContactDuplicateScanCache | null> {
  const raw = await getObject(CACHE_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cache = raw as ContactDuplicateScanCache;
  if (!Array.isArray(cache.pairs)) return null;
  return cache;
}

export async function invalidateDuplicateScanCache(): Promise<void> {
  await deleteObject(CACHE_KEY);
}

async function getCachedDuplicatePairs(): Promise<ContactDuplicatePair[] | null> {
  const cache = await getDuplicateScanCache();
  return cache?.pairs ?? null;
}

export async function runContactsDuplicateScan(
  onProgress?: (processed: number, total: number) => void | Promise<void>,
  repo: ContactsRepository = contactsRepository,
): Promise<{ pairCount: number; contactCount: number }> {
  const tenant = getRequestTenant();
  const preferences = await loadContactPreferences();
  const total = tenant ? await repo.countByWorkspace(tenant, { deleted: "active" }) : 0;
  await onProgress?.(0, Math.max(total, 1));
  const pairs = await findBlockedDuplicatePairs(preferences, repo);

  const cache: ContactDuplicateScanCache = {
    computedAt: new Date().toISOString(),
    contactCount: total,
    pairCount: pairs.length,
    pairs,
  };
  await saveObject(CACHE_KEY, cache);
  await onProgress?.(total, Math.max(total, 1));

  return { pairCount: pairs.length, contactCount: total };
}

export async function loadDuplicatePairsPage(
  query: {
    page?: number;
    limit?: number;
  },
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsDuplicatePairsPageResult> {
  let pairs = await getCachedDuplicatePairs();
  if (!pairs) {
    pairs = await findBlockedDuplicatePairs(await loadContactPreferences(), repo);
  }
  return paginateContactDuplicatePairs(pairs, query.page ?? 1, query.limit ?? 50);
}

/** Count duplicate matches for a draft contact — SQL candidate pre-filter, no tenant walk. */
export async function countContactDuplicateMatches(
  contact: Contact,
  repo: ContactsRepository = contactsRepository,
): Promise<number> {
  const tenant = getRequestTenant();
  const preferences = await loadContactPreferences();
  const keys: ContactDuplicateCandidateKeys = {
    ...getContactDuplicateCandidateKeys(contact, preferences ?? {}),
    namePrefixes: preferences?.namePrefixesToIgnore ?? [],
  };
  const excludeIds = contact.id != null ? [String(contact.id)] : [];
  const ids = await loadContactDuplicateCandidateIds(keys, excludeIds, repo);
  if (ids.length === 0) return 0;

  const peers = tenant ? (await repo.findByIds(tenant, ids)).filter((c) => !c.deletedAt) : [];
  const pairs = findContactDuplicatePairs([...peers, contact], preferences ?? {});
  return pairs.filter((pair) =>
    pair.contacts.some(
      (row) => row === contact || (contact.id != null && String(row.id) === String(contact.id)),
    ),
  ).length;
}
