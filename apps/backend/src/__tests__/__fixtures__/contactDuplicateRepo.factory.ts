import { vi } from "vitest";
import { getContactDuplicateCandidateKeys, type Contact } from "@mms/shared";
import type {
  ContactDuplicateCandidateKeys,
  ContactsRepository,
} from "../../contacts/repository/contactsRepository.js";

/** Typed contact builder for duplicate-scan specs. */
export function contact(id: string, name: string, phone?: string, email?: string): Contact {
  return {
    id,
    name,
    firstName: name,
    phones: phone ? [{ label: "mobile", number: phone }] : [],
    emails: email ? [{ label: "personal", address: email }] : [],
  };
}

/** Fake repo mirroring the SQL blocking semantics (ids sharing a normalized key). */
export function createFakeRepo(store: Map<string, Contact>, guardianIds: string[] = []) {
  const active = () => [...store.values()].filter((c) => c.deletedAt === undefined);
  return {
    countByWorkspace: vi.fn(async () => active().length),
    getLatestWriteAt: vi.fn(async () => null),
    listPage: vi.fn(async () => ({ contacts: [], total: 0, page: 1, limit: 50, hasMore: false })),
    findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    findByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
    ),
    findSummaryByIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.map((id) => store.get(id)).filter((c): c is Contact => Boolean(c)),
    ),
    save: vi.fn(async () => "2026-01-01T00:00:00.000Z"),
    bulkSave: vi.fn(async () => undefined),
    findExistingNormalizedContactNames: vi.fn(async () => new Set<string>()),
    findActiveContactsMatchingUniqueValues: vi.fn(async () => []),
    findContactDuplicateCandidateIds: vi.fn(
      async (
        _tenant: string,
        keys: ContactDuplicateCandidateKeys,
        excludeIds: Array<string | number> = [],
      ) =>
        active()
          .filter((c) => !excludeIds.map(String).includes(String(c.id)))
          .filter((c) => {
            const candidate = getContactDuplicateCandidateKeys(c, {});
            return (
              candidate.phones.some((p) => keys.phones.includes(p)) ||
              candidate.emails.some((e) => keys.emails.includes(e)) ||
              Boolean(keys.name && candidate.name === keys.name)
            );
          })
          .map((c) => String(c.id)),
    ),
    findContactGuardianIds: vi.fn(async (_tenant: string, ids: string[]) =>
      ids.filter((id) => guardianIds.includes(id)),
    ),
    findContactDuplicateBlockedIds: vi.fn(async (_tenant: string) => {
      const seen = new Map<string, string[]>();
      for (const c of active()) {
        const keys = getContactDuplicateCandidateKeys(c, {});
        for (const key of [...keys.phones, ...keys.emails]) {
          if (!key) continue;
          const bucket = seen.get(key) ?? [];
          bucket.push(String(c.id));
          seen.set(key, bucket);
        }
        if (keys.name) {
          const bucket = seen.get(keys.name) ?? [];
          bucket.push(String(c.id));
          seen.set(keys.name, bucket);
        }
      }
      const participants = new Set<string>();
      for (const ids of seen.values()) {
        if (new Set(ids).size >= 2) ids.forEach((id) => participants.add(id));
      }
      return [...participants];
    }),
    countFieldUsageByKeys: vi.fn(async () => ({})),
    aggregateCommandMetrics: vi.fn(async () => ({
      total: 0,
      newThisPeriod: 0,
      whatsappCount: 0,
      incompleteCount: 0,
      duplicatePairCount: 0,
    })),
    aggregateReportAnalytics: vi.fn(async () => ({
      total: 0,
      activeCount: 0,
      whatsappCount: 0,
      whatsappRate: 0,
      missingInfoCount: 0,
      newLast30Days: 0,
      newPrior30Days: 0,
      newThisPeriod: 0,
      hasSignupDates: false,
      growthRecentSignups30d: 0,
      growthPriorSignups30d: 0,
    })),
    aggregateMonthlyCreatedCounts: vi.fn(async () => []),
    aggregateWidgetQueries: vi.fn(async () => ({})),
  } as unknown as ContactsRepository;
}
