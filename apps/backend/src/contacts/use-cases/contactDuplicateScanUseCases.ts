import {
  findContactDuplicatePairs,
  getContactDuplicateCandidateKeys,
  paginateContactDuplicatePairs,
  CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY,
  CONTACT_DUPLICATE_MAX_PAIRS,
  type Contact,
  type ContactDuplicatePair,
  type ContactPreferences,
  type ContactsDuplicatePairsPageResult,
} from "@mms/shared";
import { getRequestTenant } from "../../lib/tenantContext.js";
import { logger } from "../../lib/logger.js";
import { deleteObject, getObject, saveObject } from "../../db/database.js";
import { loadContactPreferences } from "./contactPreferencesService.js";
import type {
  ContactDuplicateCandidateKeys,
  ContactsRepository,
} from "../repository/contactsRepository.js";
import { contactsRepository } from "../repository/contactsRepositoryAdapter.js";

const CACHE_KEY = CONTACTS_DUPLICATE_SCAN_CACHE_OBJECT_KEY;

/**
 * Upper bound on how long a stored scan is trusted. Contact writes invalidate the
 * cache, but a missed/raced invalidation (e.g. a preferences change before C-01's
 * fix) must not leave stale duplicate pairs forever.
 */
const DUPLICATE_SCAN_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
 * Hydrates duplicate participants with the summary projection when the repository
 * supports it (C-02): the pair finder only needs name/phones/emails/cnic, never
 * the full child graph. Adapters without `findSummaryByIds` fall back to full.
 */
async function hydrateDuplicateParticipants(
  tenant: string,
  ids: string[],
  repo: ContactsRepository,
): Promise<Contact[]> {
  if (ids.length === 0) return [];
  const fetch = repo.findSummaryByIds ?? repo.findByIds;
  return await fetch.call(repo, tenant, ids);
}

/**
 * Participants that are a parent/guardian of some child (SQL relationship and
 * student links). Their name-only pairs are not duplicates: one parent with
 * several children may hold one guardian contact per admission.
 */
async function loadGuardianIds(
  tenant: string,
  ids: string[],
  repo: ContactsRepository,
): Promise<string[]> {
  if (ids.length === 0 || typeof repo.findContactGuardianIds !== "function") return [];
  return await repo.findContactGuardianIds(tenant, ids);
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
  const [pool, guardianContactIds] = await Promise.all([
    hydrateDuplicateParticipants(tenant, blockedIds, repo),
    loadGuardianIds(tenant, blockedIds, repo),
  ]);
  return findContactDuplicatePairs(
    pool.filter((contact) => !contact.deletedAt),
    preferences ?? {},
    { guardianContactIds },
  );
}

export async function getDuplicateScanCache(): Promise<ContactDuplicateScanCache | null> {
  const raw = await getObject(CACHE_KEY);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const cache = raw as ContactDuplicateScanCache;
  if (!Array.isArray(cache.pairs)) return null;
  const computedAt = Date.parse(String(cache.computedAt ?? ""));
  if (!Number.isFinite(computedAt) || Date.now() - computedAt > DUPLICATE_SCAN_CACHE_TTL_MS) {
    return null;
  }
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
  const versionBefore = tenant ? await repo.getLatestWriteAt?.(tenant) : undefined;
  const preferences = await loadContactPreferences();
  const total = tenant ? await repo.countByWorkspace(tenant, { deleted: "active" }) : 0;
  await onProgress?.(0, Math.max(total, 1));
  const pairs = await findBlockedDuplicatePairs(preferences, repo);
  if (pairs.length >= CONTACT_DUPLICATE_MAX_PAIRS) {
    // The pair finder stopped at its ceiling; keep the capped snapshot cacheable but
    // make the truncation observable instead of silently serving a partial result.
    logger.warn(
      { pairCount: pairs.length, maxPairs: CONTACT_DUPLICATE_MAX_PAIRS },
      "Contact duplicate scan reached the pair cap; results are truncated",
    );
  }

  const versionAfter =
    tenant && repo.getLatestWriteAt ? await repo.getLatestWriteAt(tenant) : versionBefore;
  if (repo.getLatestWriteAt && versionBefore !== versionAfter) {
    // A contact write landed mid-scan; its invalidation must win over this snapshot (C-02).
    await onProgress?.(total, Math.max(total, 1));
    return { pairCount: pairs.length, contactCount: total };
  }

  const cache: ContactDuplicateScanCache = {
    computedAt: new Date().toISOString(),
    contactCount: total,
    pairCount: pairs.length,
    pairs,
  };
  await saveObject(CACHE_KEY, cache);
  if (tenant && repo.getLatestWriteAt) {
    // A write between the version check and the save already invalidated; re-delete
    // so the stale snapshot cannot survive the race.
    const versionFinal = await repo.getLatestWriteAt(tenant);
    if (versionFinal !== versionAfter) {
      await deleteObject(CACHE_KEY);
    }
  }
  await onProgress?.(total, Math.max(total, 1));

  return { pairCount: pairs.length, contactCount: total };
}

/**
 * All current duplicate pairs: the cached scan when warm, otherwise an on-demand
 * SQL-blocked scan that is persisted so paginating/reopening (and the command
 * metric) does not rescan the tenant (C-02). Single source for the pairs list
 * and the Potential Duplicates count, so the two can never disagree.
 */
export async function loadDuplicatePairs(
  repo: ContactsRepository = contactsRepository,
): Promise<ContactDuplicatePair[]> {
  const cached = await getCachedDuplicatePairs();
  if (cached) return cached;
  const tenant = getRequestTenant();
  const versionBefore = tenant ? await repo.getLatestWriteAt?.(tenant) : undefined;
  const pairs = await findBlockedDuplicatePairs(await loadContactPreferences(), repo);
  const versionAfter =
    tenant && repo.getLatestWriteAt ? await repo.getLatestWriteAt(tenant) : versionBefore;
  if (tenant && (!repo.getLatestWriteAt || versionBefore === versionAfter)) {
    // A cache-write failure must not fail the read.
    try {
      const contactCount = await repo.countByWorkspace(tenant, { deleted: "active" });
      await saveObject(CACHE_KEY, {
        computedAt: new Date().toISOString(),
        contactCount,
        pairCount: pairs.length,
        pairs,
      });
      // A write between the version check and the save already invalidated; re-delete
      // so the stale snapshot cannot survive the race (mirrors runContactsDuplicateScan).
      if (repo.getLatestWriteAt) {
        const versionFinal = await repo.getLatestWriteAt(tenant);
        if (versionFinal !== versionAfter) {
          await deleteObject(CACHE_KEY);
        }
      }
    } catch (error) {
      logger.warn({ err: error }, "Failed to cache contact duplicate pairs");
    }
  }
  return pairs;
}

export async function loadDuplicatePairsPage(
  query: {
    page?: number;
    limit?: number;
  },
  repo: ContactsRepository = contactsRepository,
): Promise<ContactsDuplicatePairsPageResult> {
  const pairs = await loadDuplicatePairs(repo);
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

  if (!tenant) return 0;
  const [hydrated, guardianContactIds] = await Promise.all([
    hydrateDuplicateParticipants(tenant, ids, repo),
    loadGuardianIds(tenant, [...ids, ...excludeIds], repo),
  ]);
  const peers = hydrated.filter((c) => !c.deletedAt);
  const pairs = findContactDuplicatePairs([...peers, contact], preferences ?? {}, {
    guardianContactIds,
  });
  return pairs.filter((pair) =>
    pair.contacts.some(
      (row) => row === contact || (contact.id != null && String(row.id) === String(contact.id)),
    ),
  ).length;
}
