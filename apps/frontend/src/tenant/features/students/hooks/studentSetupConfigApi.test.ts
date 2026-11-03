import { describe, expect, it, vi } from "vitest";
import { normalizeStudentModulePreferences } from "@mms/shared";
import { apiContract } from "@/lib/api";
import { saveStudentPreferencesAsync } from "@/tenant/features/students/hooks/studentSetupConfigApi";

vi.mock("@/lib/api", () => ({
  apiContract: {
    students: {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    },
  },
}));

const preferences = normalizeStudentModulePreferences(null);

describe("saveStudentPreferencesAsync", () => {
  it.each([400, 500])("rejects so the UI cannot claim success on a %i", async (status) => {
    vi.mocked(apiContract.students.updatePreferences).mockResolvedValue({
      status,
      body: { type: status === 400 ? "validation_error" : "server_error", message: "Save failed" },
      headers: new Headers(),
    } as never);

    await expect(saveStudentPreferencesAsync(preferences)).rejects.toMatchObject({ status });
  });

  it("returns the saved preferences on success", async () => {
    const saved = { ...preferences, grNumberDigits: 8 };
    vi.mocked(apiContract.students.updatePreferences).mockResolvedValue({
      status: 200,
      body: { preferences: saved },
      headers: new Headers(),
    } as never);

    await expect(saveStudentPreferencesAsync(preferences)).resolves.toEqual(saved);
  });
});
