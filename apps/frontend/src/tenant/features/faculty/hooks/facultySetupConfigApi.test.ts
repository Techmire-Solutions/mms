/**
 * Faculty Setup config transport.
 *
 * `apiContract` resolves non-2xx envelopes, so a preferences/field-config save
 * that never inspects the status reports "saved" on a 403/500.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  getFieldConfig: vi.fn(),
  updateFieldConfig: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    faculty: {
      getPreferences: (...args: unknown[]) => mocks.getPreferences(...args),
      updatePreferences: (...args: unknown[]) => mocks.updatePreferences(...args),
      getFieldConfig: (...args: unknown[]) => mocks.getFieldConfig(...args),
      updateFieldConfig: (...args: unknown[]) => mocks.updateFieldConfig(...args),
    },
  },
}));

import {
  fetchFacultyFieldConfig,
  saveFacultyFieldConfigAsync,
  saveFacultyPreferencesAsync,
} from "./facultySetupConfigApi";

const PREFERENCES = { employeeIdPrefix: "FAC" } as never;

describe("facultySetupConfigApi status guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a failed preferences save instead of reporting it saved", async () => {
    mocks.updatePreferences.mockResolvedValue({
      status: 500,
      body: { type: "server_error", message: "Failed to save faculty preferences" },
    });

    await expect(saveFacultyPreferencesAsync(PREFERENCES)).rejects.toMatchObject({ status: 500 });
  });

  it("resolves a saved preferences payload on 200", async () => {
    mocks.updatePreferences.mockResolvedValue({
      status: 200,
      body: { preferences: PREFERENCES },
    });

    const saved = await saveFacultyPreferencesAsync(PREFERENCES);
    expect(saved.employeeIdPrefix).toBe("FAC");
  });

  it("rejects a failed field-config read", async () => {
    mocks.getFieldConfig.mockResolvedValue({
      status: 500,
      body: { type: "server_error", message: "nope" },
    });

    await expect(fetchFacultyFieldConfig()).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a failed field-config save", async () => {
    mocks.updateFieldConfig.mockResolvedValue({
      status: 403,
      body: { type: "forbidden", message: "Insufficient permissions" },
    });

    await expect(
      saveFacultyFieldConfigAsync({ fields: {}, formTabs: [] } as never),
    ).rejects.toMatchObject({ status: 403 });
  });
});
