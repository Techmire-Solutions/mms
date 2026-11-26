import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import { runWithTenant } from "@mms/be-core/http";
import type { ContactsRepository } from "../repository/index.js";

const callOrder: string[] = [];

vi.mock("../systemTags/contactSystemTagUseCases.js", () => ({
  reconcileContactSystemTags: vi.fn(async () => {
    callOrder.push("reconcileContactSystemTags");
    return 1;
  }),
  removeSystemTagsForContacts: vi.fn(async () => {
    callOrder.push("removeSystemTagsForContacts");
  }),
}));

vi.mock("@mms/be-core/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/be-core/audit")>();
  return {
    ...actual,
    recordModernAuditEvent: vi.fn(async () => {
      callOrder.push("recordModernAuditEvent");
      return {
        id: 1,
        hashPrevious: "0".repeat(64),
        hashCurrent: "a".repeat(64),
        canonicalPayload: "{}",
      };
    }),
    sanitizeAuditState: (value: unknown) => value,
  };
});

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn(async () => undefined),
  emitOutboxEvents: vi.fn(async () => undefined),
}));

vi.mock("@mms/db/client", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runInTransaction: (callback: () => unknown) => callback(),
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: vi.fn(async () => undefined),
}));

vi.mock("@mms/be-core/cache", () => ({
  invalidateMultiTierCache: vi.fn(async () => undefined),
}));

vi.mock("../use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: vi.fn(async () => undefined),
}));

vi.mock("../use-cases/contactAttachmentUrls.js", () => ({
  assertContactAttachmentUrls: vi.fn(),
}));

vi.mock("../use-cases/contactValidationUseCases.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-cases/contactValidationUseCases.js")>();
  return {
    ...actual,
    assertContactUniqueFields: vi.fn(async () => undefined),
    prepareContactRecord: vi.fn(async (contact: Contact, id?: string | number) => ({
      ...contact,
      id: String(id ?? contact.id ?? "c-1"),
    })),
    validateContactDynamic: vi.fn(async () => undefined),
  };
});

vi.mock("../use-cases/contactWriteContext.js", () => ({
  loadContactWriteContext: vi.fn(async () => ({
    fieldConfig: null,
    lookups: {},
    preferences: null,
    relationshipPairs: [{ id: "pair-1", forward: "Parent", inverse: "Child" }],
    runtimeDefaults: { defaultPhoneCountryCode: "+92" },
  })),
}));

const {
  upsertContact,
  updateContactById,
  mergeContactsById,
  restoreContactById,
  bulkRestoreContacts,
} = await import("../use-cases/index.js");

function makeContact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    firstName: "Ali",
    lastName: "Khan",
    name: "Ali Khan",
    phones: [],
    relationshipContacts: [],
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  } as Contact;
}

describe("Contacts write advisory-lock order", () => {
  beforeEach(() => {
    callOrder.length = 0;
  });

  it("given reciprocal relationship inference on updateContactById, should reconcile system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const source = makeContact("c-source");
    const target = makeContact("c-target");
    const updatedSource = makeContact("c-source", {
      relationshipContacts: [{ contactId: "c-target", relationship: "Parent" }],
    });
    const repo = {
      findById: vi.fn(async () => source),
      findByIds: vi.fn(async () => [target]),
      save: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
      saveIfVersionMatches: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
    } as unknown as ContactsRepository;

    // Act
    await runWithTenant("ops-tenant", () =>
      updateContactById("c-source", updatedSource, { actorId: "u-1" }, repo),
    );

    // Assert
    const reconcileIdx = callOrder.indexOf("reconcileContactSystemTags");
    const firstAuditIdx = callOrder.indexOf("recordModernAuditEvent");
    expect(reconcileIdx).toBeGreaterThanOrEqual(0);
    expect(firstAuditIdx).toBeGreaterThan(reconcileIdx);
  });

  it("given reciprocal relationship inference on upsertContact, should reconcile system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const target = makeContact("c-target");
    const incoming = makeContact("c-source", {
      relationshipContacts: [{ contactId: "c-target", relationship: "Parent" }],
    });
    const repo = {
      findById: vi.fn(async () => null),
      findByIds: vi.fn(async () => [target]),
      save: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
      saveIfVersionMatches: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
    } as unknown as ContactsRepository;

    // Act
    await runWithTenant("ops-tenant", () => upsertContact(incoming, { actorId: "u-1" }, repo));

    // Assert
    const reconcileIdx = callOrder.indexOf("reconcileContactSystemTags");
    const firstAuditIdx = callOrder.indexOf("recordModernAuditEvent");
    expect(reconcileIdx).toBeGreaterThanOrEqual(0);
    expect(firstAuditIdx).toBeGreaterThan(reconcileIdx);
  });

  it("given reciprocal relationship inference on mergeContactsById, should reconcile system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const keep = makeContact("c-keep", {
      relationshipContacts: [{ contactId: "c-target", relationship: "Parent" }],
    });
    const loser = makeContact("c-lose");
    const target = makeContact("c-target");
    const repo = {
      findById: vi.fn(async (_t: string, id: string) => (id === "c-keep" ? keep : loser)),
      findByIds: vi.fn(async () => [target]),
      save: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
      saveIfVersionMatches: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
      reparentContactReferences: vi.fn(async () => undefined),
      clearMergedContactChildren: vi.fn(async () => undefined),
    } as unknown as ContactsRepository;

    // Act
    await runWithTenant("ops-tenant", () =>
      mergeContactsById("c-keep", "c-lose", undefined, "u-1", repo),
    );

    // Assert
    const reconcileIdx = callOrder.indexOf("reconcileContactSystemTags");
    const firstAuditIdx = callOrder.indexOf("recordModernAuditEvent");
    expect(reconcileIdx).toBeGreaterThanOrEqual(0);
    expect(firstAuditIdx).toBeGreaterThan(reconcileIdx);
  });

  it("given restoreContactById, should reconcile system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const trashed = makeContact("c-trashed", { deletedAt: "2026-02-01T00:00:00.000Z" });
    const repo = {
      findById: vi.fn(async () => trashed),
      save: vi.fn(async () => "2026-03-01T01:00:00.000Z"),
    } as unknown as ContactsRepository;

    // Act
    await runWithTenant("ops-tenant", () => restoreContactById("c-trashed", "u-1", repo));

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });

  it("given bulkRestoreContacts, should reconcile system tags before acquiring the audit shard lock", async () => {
    // Arrange
    const trashed = makeContact("c-trashed-1", { deletedAt: "2026-02-01T00:00:00.000Z" });
    const repo = {
      findByIds: vi.fn(async () => [trashed]),
      bulkSave: vi.fn(async () => undefined),
    } as unknown as ContactsRepository;

    // Act
    await runWithTenant("ops-tenant", () => bulkRestoreContacts(["c-trashed-1"], "u-1", repo));

    // Assert
    expect(callOrder).toEqual(["reconcileContactSystemTags", "recordModernAuditEvent"]);
  });
});
