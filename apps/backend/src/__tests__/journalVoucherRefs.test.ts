import { describe, expect, it, vi } from "vitest";
import type { JournalEntry } from "@mms/shared";
import { assignVoucherRefs } from "../accounting/use-cases/journalVoucherRefs.js";
import { ConflictError, ValidationError } from "../lib/httpErrors.js";

const TENANT = "tenant-accounting";

describe("journalVoucherRefs", () => {
  it("given batch with duplicate explicit refs, should throw ConflictError with 409 status", async () => {
    // Arrange
    const mockRepo = { allocateVoucherNumbers: vi.fn() };
    const entries: JournalEntry[] = [
      { id: "e1", date: "2026-03-01", ref: "VR-001" } as JournalEntry,
      { id: "e2", date: "2026-03-01", ref: "VR-001" } as JournalEntry,
    ];

    // Act & Assert
    await expect(assignVoucherRefs(mockRepo, TENANT, entries)).rejects.toThrow(ConflictError);
    await expect(assignVoucherRefs(mockRepo, TENANT, entries)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Duplicate reference "VR-001" within the same batch',
    });
    expect(mockRepo.allocateVoucherNumbers).not.toHaveBeenCalled();
  });

  it("given existing stored refs in storedRefById, should preserve existing voucher numbers", async () => {
    // Arrange
    const mockRepo = { allocateVoucherNumbers: vi.fn() };
    const entries: JournalEntry[] = [
      { id: "e1", date: "2026-03-01", ref: "" } as JournalEntry,
      { id: "e2", date: "2026-03-01", ref: "EXPLICIT-REF" } as JournalEntry,
    ];
    const storedRefs = new Map<string, string | undefined>([["e1", "PRESERVED-REF-101"]]);

    // Act
    const resolved = await assignVoucherRefs(mockRepo, TENANT, entries, storedRefs);

    // Assert
    expect(resolved).toHaveLength(2);
    expect(resolved[0].ref).toBe("PRESERVED-REF-101");
    expect(resolved[1].ref).toBe("EXPLICIT-REF");
    expect(mockRepo.allocateVoucherNumbers).not.toHaveBeenCalled();
  });

  it("given entries with blank refs and enabled allocator, should allocate numbers grouped by date", async () => {
    // Arrange
    const mockRepo = {
      allocateVoucherNumbers: vi
        .fn()
        .mockImplementation((_tenant: string, payload: { date: string; count: number }) => {
          if (payload.date === "2026-03-01") {
            return Promise.resolve(["VR-2026-03-001", "VR-2026-03-002"]);
          }
          if (payload.date === "2026-03-02") {
            return Promise.resolve(["VR-2026-03-003"]);
          }
          return Promise.resolve([]);
        }),
    };
    const entries: JournalEntry[] = [
      { id: "e1", date: "2026-03-01", ref: "" } as JournalEntry,
      { id: "e2", date: "2026-03-01", ref: "   " } as JournalEntry,
      { id: "e3", date: "2026-03-02", ref: "" } as JournalEntry,
    ];

    // Act
    const resolved = await assignVoucherRefs(mockRepo, TENANT, entries);

    // Assert
    expect(resolved).toHaveLength(3);
    expect(resolved[0].ref).toBe("VR-2026-03-001");
    expect(resolved[1].ref).toBe("VR-2026-03-002");
    expect(resolved[2].ref).toBe("VR-2026-03-003");
    expect(mockRepo.allocateVoucherNumbers).toHaveBeenCalledTimes(2);
    expect(mockRepo.allocateVoucherNumbers).toHaveBeenNthCalledWith(
      1,
      TENANT,
      expect.objectContaining({
        date: "2026-03-01",
        count: 2,
      }),
    );
    expect(mockRepo.allocateVoucherNumbers).toHaveBeenNthCalledWith(
      2,
      TENANT,
      expect.objectContaining({
        date: "2026-03-02",
        count: 1,
      }),
    );
  });

  it("given allocator returning null, should throw ValidationError with 400 status", async () => {
    // Arrange
    const mockRepo = {
      allocateVoucherNumbers: vi.fn().mockResolvedValue(null),
    };
    const entries: JournalEntry[] = [{ id: "e1", date: "2026-03-01", ref: "" } as JournalEntry];

    // Act & Assert
    await expect(assignVoucherRefs(mockRepo, TENANT, entries)).rejects.toThrow(ValidationError);
    await expect(assignVoucherRefs(mockRepo, TENANT, entries)).rejects.toMatchObject({
      statusCode: 400,
      message: "A reference number is required because automatic voucher numbering is off",
    });
  });

  it("given batch with mixed explicit and blank refs, should allocate numbers while passing reserved refs", async () => {
    // Arrange
    let capturedReserved: Set<string> | undefined;
    const mockRepo = {
      allocateVoucherNumbers: vi
        .fn()
        .mockImplementation((_tenant: string, payload: { reserved: Set<string> }) => {
          capturedReserved = new Set(payload.reserved);
          return Promise.resolve(["ALLOCATED-002"]);
        }),
    };
    const entries: JournalEntry[] = [
      { id: "e1", date: "2026-03-05", ref: "EXISTING-001" } as JournalEntry,
      { id: "e2", date: "2026-03-05", ref: "" } as JournalEntry,
    ];

    // Act
    const resolved = await assignVoucherRefs(mockRepo, TENANT, entries);

    // Assert
    expect(resolved).toHaveLength(2);
    expect(resolved[0].ref).toBe("EXISTING-001");
    expect(resolved[1].ref).toBe("ALLOCATED-002");
    expect(capturedReserved?.has("EXISTING-001")).toBe(true);
  });

  it("given allocator without allocateVoucherNumbers, should generate fallback JE- UUID refs", async () => {
    // Arrange
    const mockRepo = {} as unknown as { allocateVoucherNumbers?: undefined };
    const entries: JournalEntry[] = [{ id: "e1", date: "2026-03-01", ref: "" } as JournalEntry];

    // Act
    const resolved = await assignVoucherRefs(mockRepo, TENANT, entries);

    // Assert
    expect(resolved).toHaveLength(1);
    expect(resolved[0].ref).toMatch(/^JE-[a-f0-9]{8}$/);
  });
});
