import { describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import { archiveMergeLoser } from "../use-cases/index.js";
import type { ContactsRepository } from "../repository/index.js";

const emitOutboxEventMock = vi.fn();
vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: (...args: unknown[]) => emitOutboxEventMock(...args),
}));

describe("contactMergeArchive - archiveMergeLoser", () => {
  it("archives the merged-away contact with cleared child collections and emits CDC event", async () => {
    emitOutboxEventMock.mockReset();
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const repo = {
      save: saveMock,
    } as unknown as ContactsRepository;

    const loserContact: Contact = {
      id: "cnt-loser",
      firstName: "Loser",
      lastName: "Contact",
      phones: [{ id: "p1", number: "1234567890" }],
      emails: [{ id: "e1", address: "loser@example.com" }],
      addresses: [{ id: "a1", street: "123 Main" }],
      socials: [{ id: "s1", platform: "twitter", url: "https://twitter.com" }],
      education: [{ id: "ed1", institution: "Uni" }],
      experience: [{ id: "ex1", company: "Corp" }],
      skills: [{ id: "sk1", name: "Coding" }],
      bankDetails: [{ id: "b1", bankName: "Bank" }],
      activities: [{ id: "ac1", title: "Activity" }],
      attachments: [{ id: "at1", fileName: "doc.pdf" }],
    } as unknown as Contact;

    await archiveMergeLoser(
      repo,
      "tenant-a",
      loserContact,
      "cnt-survivor",
      "cnt-loser",
      "user-123",
    );

    expect(saveMock).toHaveBeenCalledTimes(1);
    const [savedTenant, savedContact] = saveMock.mock.calls[0] as [string, Contact];
    expect(savedTenant).toBe("tenant-a");
    expect(savedContact.id).toBe("cnt-loser");
    expect(savedContact.deletedBy).toBe("user-123");
    expect(savedContact.deletionReason).toBe("Merged into cnt-survivor");
    expect(savedContact.deletedAt).toBeDefined();
    expect(savedContact.phones).toEqual([]);
    expect(savedContact.emails).toEqual([]);
    expect(savedContact.addresses).toEqual([]);
    expect(savedContact.socials).toEqual([]);
    expect(savedContact.education).toEqual([]);
    expect(savedContact.experience).toEqual([]);
    expect(savedContact.skills).toEqual([]);
    expect(savedContact.bankDetails).toEqual([]);
    expect(savedContact.activities).toEqual([]);
    expect(savedContact.attachments).toEqual([]);

    expect(emitOutboxEventMock).toHaveBeenCalledTimes(1);
    expect(emitOutboxEventMock).toHaveBeenCalledWith(
      "entity.soft_deleted",
      expect.objectContaining({
        entityType: "contacts",
        entityId: "cnt-loser",
        tenantId: "tenant-a",
        deletedBy: "user-123",
        deletionReason: "Merged into cnt-survivor",
      }),
    );
  });
});
