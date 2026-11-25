import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSaveContactPreferences = vi.fn();
const mockInvalidateDuplicateScanCache = vi.fn();

vi.mock("../use-cases/contactPreferencesService.js", () => ({
  loadContactPreferences: vi.fn(),
  saveContactPreferences: (...args: unknown[]) => mockSaveContactPreferences(...args),
}));

vi.mock("../use-cases/contactDuplicateScanUseCases.js", () => ({
  invalidateDuplicateScanCache: (...args: unknown[]) => mockInvalidateDuplicateScanCache(...args),
}));

vi.mock("../use-cases/contactConfigService.js", () => ({
  loadContactFieldConfig: vi.fn(),
  saveContactFieldConfig: vi.fn(),
}));

vi.mock("../routes/tenant/contactRouteHelpers.js", () => ({
  auditContact: vi.fn(),
}));

import { saveContactPreferencesAndInvalidateDuplicates } from "../routes/index.js";

describe("contact preferences cache invalidation (C-01)", () => {
  beforeEach(() => {
    mockSaveContactPreferences.mockReset();
    mockInvalidateDuplicateScanCache.mockReset().mockResolvedValue(undefined);
  });

  it("invalidates the duplicate scan cache after a successful preferences save", async () => {
    const saved = { defaultCountry: "PK" };
    mockSaveContactPreferences.mockResolvedValue(saved);

    const result = await saveContactPreferencesAndInvalidateDuplicates({
      defaultCountry: "PK",
    } as never);

    expect(mockSaveContactPreferences).toHaveBeenCalledWith({ defaultCountry: "PK" });
    expect(mockInvalidateDuplicateScanCache).toHaveBeenCalledTimes(1);
    expect(result).toBe(saved);
  });

  it("keeps the save successful when cache invalidation fails", async () => {
    const saved = { defaultCountry: "PK" };
    const onInvalidateError = vi.fn();
    mockSaveContactPreferences.mockResolvedValue(saved);
    mockInvalidateDuplicateScanCache.mockRejectedValue(new Error("redis down"));

    await expect(
      saveContactPreferencesAndInvalidateDuplicates(
        { defaultCountry: "PK" } as never,
        onInvalidateError,
      ),
    ).resolves.toBe(saved);
    expect(onInvalidateError).toHaveBeenCalledWith(expect.any(Error));
  });
});
