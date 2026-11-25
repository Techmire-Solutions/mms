import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetRequestTenant = vi.fn();

vi.mock("@mms/db/request-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/request-context")>()),
  ...{
    getRequestTenant: () => mockGetRequestTenant(),
    requireTenant: () => {
      const t = mockGetRequestTenant();
      if (!t) throw new Error("Tenant context required");
      return t.trim().toLowerCase();
    },
  },
}));

const mockGetPreferences = vi.fn();
const mockSetPreferences = vi.fn();

vi.mock("../obligations/repository/obligationsRepositoryAdapter.js", () => ({
  obligationsRepository: {
    getPreferences: (...args: unknown[]) => mockGetPreferences(...args),
    setPreferences: (...args: unknown[]) => mockSetPreferences(...args),
  },
}));

import {
  getObligationPreferencesService,
  updateObligationPreferencesService,
} from "../services/obligationPreferencesService.js";

describe("obligationPreferencesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("tenant-a");
  });

  it("loads normalized preferences from repository", async () => {
    mockGetPreferences.mockResolvedValueOnce({
      receiptPrefix: "OBL-CUSTOM",
      receiptSequenceDigits: 6,
    });

    const result = await getObligationPreferencesService();
    expect(result).toBeDefined();
    expect(result?.receiptPrefix).toBe("OBL-CUSTOM");
    expect(result?.receiptSequenceDigits).toBe(6);
    expect(result?.receiptYearFormat).toBe("YYYY");
    expect(mockGetPreferences).toHaveBeenCalledWith("tenant-a");
  });

  it("returns null when repository returns null", async () => {
    mockGetPreferences.mockResolvedValueOnce(null);

    const result = await getObligationPreferencesService();
    expect(result).toBeNull();
  });

  it("saves normalized preferences and broadcasts live update", async () => {
    mockSetPreferences.mockResolvedValueOnce(undefined);

    const saved = await updateObligationPreferencesService({
      receiptPrefix: "NEW-PREFIX",
    });

    expect(saved.receiptPrefix).toBe("NEW-PREFIX");
    expect(mockSetPreferences).toHaveBeenCalledWith(
      "tenant-a",
      expect.objectContaining({ receiptPrefix: "NEW-PREFIX" }),
    );
  });
});
