import { describe, expect, it, vi, beforeEach } from "vitest";
import { runWithTenant } from "../lib/tenantContext.js";

const mockRepo = vi.hoisted(() => ({
  listFeeStructures: vi.fn(),
  saveFeeStructure: vi.fn(),
  deleteFeeStructure: vi.fn(),
}));

const mockWs = vi.hoisted(() => ({
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../db/repositories/financeBillingRepository.js", () => mockRepo);
vi.mock("../lib/livePush.js", () => mockWs);

import {
  loadFeeStructures,
  upsertFeeStructure,
  removeFeeStructure,
} from "../finance/use-cases/financeBillingUseCases.js";

describe("financeBillingUseCases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when tenant context is missing", async () => {
    await expect(loadFeeStructures()).rejects.toThrow(/Tenant context required/);
  });

  it("loadFeeStructures delegates to repository", async () => {
    const fakeList = [
      { id: "fs-1", name: "Tuition", amount: 500, frequency: "monthly", isActive: true, items: [] },
    ];
    mockRepo.listFeeStructures.mockResolvedValue(fakeList);

    const result = await runWithTenant("test-tenant", () => loadFeeStructures());
    expect(result).toEqual(fakeList);
    expect(mockRepo.listFeeStructures).toHaveBeenCalledWith("test-tenant");
  });

  it("upsertFeeStructure validates schema, persists, and broadcasts update", async () => {
    mockRepo.saveFeeStructure.mockResolvedValue(undefined);

    const input = {
      name: "Standard Fee",
      session: "2026",
      className: "Grade 1",
      frequency: "monthly" as const,
      isActive: true,
      items: [{ name: "Tuition", amount: 1000, sortOrder: 0 }],
    };

    const record = await runWithTenant("test-tenant", () => upsertFeeStructure(input));

    expect(record.name).toBe("Standard Fee");
    expect(record.items).toHaveLength(1);
    expect(record.items[0]?.id).toBe("fi-1");
    expect(mockRepo.saveFeeStructure).toHaveBeenCalledWith("test-tenant", record);
    expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
      "test-tenant",
      "collection",
      "finance_fee_structures",
    );
  });

  it("removeFeeStructure deletes from repo and broadcasts update", async () => {
    mockRepo.deleteFeeStructure.mockResolvedValue(undefined);

    await runWithTenant("test-tenant", () => removeFeeStructure("fs-123"));

    expect(mockRepo.deleteFeeStructure).toHaveBeenCalledWith("test-tenant", "fs-123");
    expect(mockWs.broadcastTenantUpdate).toHaveBeenCalledWith(
      "test-tenant",
      "collection",
      "finance_fee_structures",
    );
  });
});
