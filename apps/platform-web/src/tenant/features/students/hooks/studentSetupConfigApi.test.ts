import { describe, expect, it, vi } from "vitest";
import {
  normalizeStudentModulePreferences,
  normalizeStudentsSettings,
  setStudentFieldRequired,
  studentFieldConfigPutBodySchema,
  type FieldDefinition,
} from "@mms/contracts";
import { apiContract } from "@mms/fe-core/api/tsRest";
import {
  fetchStudentFieldConfig,
  saveStudentFieldConfigAsync,
  saveStudentPreferencesAsync,
} from "@/tenant/features/students/hooks/studentSetupConfigApi";

vi.mock("@mms/fe-core/api/tsRest", () => ({
  apiContract: {
    students: {
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
      getFieldConfig: vi.fn(),
      updateFieldConfig: vi.fn(),
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

describe("student field config API", () => {
  it("given no saved config, should fall back to the seeded field registry", async () => {
    // Arrange
    vi.mocked(apiContract.students.getFieldConfig).mockResolvedValue({
      status: 200,
      body: { config: null },
      headers: new Headers(),
    } as never);

    // Act
    const config = await fetchStudentFieldConfig();

    // Assert
    expect(config.fields).toEqual(normalizeStudentsSettings(null).fields);
  });

  it("given a required-field change, should send a body the strict PUT DTO accepts", async () => {
    // Arrange
    const settings = normalizeStudentsSettings(null);
    const fields = setStudentFieldRequired(
      settings.fields as Record<string, FieldDefinition[]>,
      "education",
      true,
    );
    vi.mocked(apiContract.students.updateFieldConfig).mockImplementation((async ({
      body,
    }: {
      body: Record<string, unknown>;
    }) => ({
      status: 200,
      body: { success: true, config: body },
      headers: new Headers(),
    })) as never);

    // Act
    const saved = await saveStudentFieldConfigAsync({ ...settings, fields });

    // Assert
    const sent = vi.mocked(apiContract.students.updateFieldConfig).mock.calls[0]?.[0]?.body;
    expect(studentFieldConfigPutBodySchema.safeParse(sent).success).toBe(true);
    expect(sent).not.toHaveProperty("formTabs");
    expect(sent).not.toHaveProperty("grNumberDigits");
    const education = (saved.fields as Record<string, FieldDefinition[]>).basic.find(
      (field) => field.key === "education",
    );
    expect(education?.required).toBe(true);
  });

  it("rejects so the Setup tab cannot claim success on a 500", async () => {
    // Arrange
    vi.mocked(apiContract.students.updateFieldConfig).mockResolvedValue({
      status: 500,
      body: { type: "server_error", message: "Save failed" },
      headers: new Headers(),
    } as never);

    // Act / Assert
    await expect(
      saveStudentFieldConfigAsync(normalizeStudentsSettings(null)),
    ).rejects.toMatchObject({
      status: 500,
    });
  });
});
