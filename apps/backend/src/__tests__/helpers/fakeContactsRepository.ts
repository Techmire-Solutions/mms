import { vi } from "vitest";
import type { ContactsRepository } from "@mms/mod-contacts/backend/repository";

/**
 * In-memory stand-in for the contacts storage gateway.
 *
 * The module's route handlers call their use cases through relative imports, so
 * app-level tests cannot mock them by package specifier. They inject this fake
 * through `setContactsRepositoryForTesting` instead and assert on the calls.
 */
export function createFakeContactsRepository(
  overrides: Partial<ContactsRepository> = {},
): ContactsRepository {
  const defaults = {
    countByWorkspace: vi.fn().mockResolvedValue(0),
    getLatestWriteAt: vi.fn().mockResolvedValue(null),
    listPage: vi
      .fn()
      .mockResolvedValue({ contacts: [], total: 0, page: 1, limit: 25, hasMore: false }),
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    findSummaryByIds: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(new Date().toISOString()),
    saveIfVersionMatches: vi.fn().mockResolvedValue({ ok: true }),
    replaceContactTags: vi.fn().mockResolvedValue(undefined),
    bulkSave: vi.fn().mockResolvedValue(undefined),
    bulkSoftDelete: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    bulkRestore: vi.fn().mockResolvedValue({ succeeded: 0, failed: 0 }),
    findExistingNormalizedContactNames: vi.fn().mockResolvedValue(new Set()),
    findActiveContactsMatchingUniqueValues: vi.fn().mockResolvedValue([]),
    findContactDuplicateCandidateIds: vi.fn().mockResolvedValue([]),
    findContactDuplicateBlockedIds: vi.fn().mockResolvedValue([]),
    findContactGuardianIds: vi.fn().mockResolvedValue([]),
    reparentContactReferences: vi.fn().mockResolvedValue(undefined),
    acquireUniqueValueLocks: vi.fn().mockResolvedValue(undefined),
    aggregateCommandMetrics: vi.fn().mockResolvedValue({}),
    aggregateReportAnalytics: vi.fn().mockResolvedValue({}),
    aggregateMonthlyCreatedCounts: vi.fn().mockResolvedValue([]),
    aggregateWidgetQueries: vi.fn().mockResolvedValue([]),
    guardDeleteDependents: vi.fn().mockResolvedValue(undefined),
    findDeleteBlockers: vi.fn().mockResolvedValue([]),
    isAttachmentReferenced: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
  return defaults as unknown as ContactsRepository;
}
