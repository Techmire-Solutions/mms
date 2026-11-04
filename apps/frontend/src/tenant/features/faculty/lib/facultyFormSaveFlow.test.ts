/**
 * Faculty form save ordering.
 *
 * The linked user account is a side effect of the faculty record, not the other
 * way round: writing `users.create`/`users.update` first leaves an orphan account
 * (or an applied role) behind when the faculty write fails.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const mocks = vi.hoisted(() => ({
  validateFacultyDraft: vi.fn(() => null),
  checkFacultyFormDuplicate: vi.fn(async () => null),
  facultyValidationErrorsByField: vi.fn(() => ({})),
  focusFacultyValidationField: vi.fn(),
  syncUserAccount: vi.fn(async () => true),
  notifyFacultySaveFailed: vi.fn(),
  buildFacultySavePayload: vi.fn(() => ({ contactId: "c1", employeeId: "EMP-1" })),
  validateUserDraftRequirements: vi.fn(() => true),
  isEmployeeIdConflictError: vi.fn(() => false),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: { error: mocks.notifyError, success: mocks.notifySuccess },
}));

vi.mock("../lib/facultyFormValidation", () => ({
  validateFacultyDraft: mocks.validateFacultyDraft,
  checkFacultyFormDuplicate: mocks.checkFacultyFormDuplicate,
  facultyValidationErrorsByField: mocks.facultyValidationErrorsByField,
  focusFacultyValidationField: mocks.focusFacultyValidationField,
  DUPLICATE_ERROR_KEYS: { employeeId: "faculty.errors.duplicateEmployeeId" },
}));

vi.mock("../lib/facultyFormUserSync", () => ({
  syncUserAccount: mocks.syncUserAccount,
  notifyFacultySaveFailed: mocks.notifyFacultySaveFailed,
  confirmPendingFacultySave: vi.fn(),
}));

vi.mock("../lib/facultyFormSavePayload", () => ({
  buildFacultySavePayload: mocks.buildFacultySavePayload,
  validateUserDraftRequirements: mocks.validateUserDraftRequirements,
  isEmployeeIdConflictError: mocks.isEmployeeIdConflictError,
}));

import { runFacultySaveFlow, type FacultySaveFlowInput } from "./facultyFormSaveFlow";

const t = ((key: string) => key) as unknown as TranslationFunction;

function input(overrides: Partial<FacultySaveFlowInput> = {}): FacultySaveFlowInput {
  return {
    facultyDraft: { contactId: "c1" },
    autoGenerateId: false,
    formInstanceId: "form-1",
    settings: {} as FacultySaveFlowInput["settings"],
    enabledTabs: new Set<string>(),
    fields: {},
    language: "en",
    t,
    onSave: vi.fn(async () => undefined),
    onClose: vi.fn(),
    setErrors: vi.fn(),
    setSaving: vi.fn(),
    setPendingSaveData: vi.fn(),
    setTypedDuplicateReason: vi.fn(),
    setDuplicateConfirmOpen: vi.fn(),
    userAccountDraft: {
      enabled: true,
      role: "admin",
      setupMethod: "password",
      password: "secret",
    },
    linkedUser: null,
    ...overrides,
  };
}

describe("runFacultySaveFlow save ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateFacultyDraft.mockReturnValue(null);
    mocks.checkFacultyFormDuplicate.mockResolvedValue(null);
    mocks.validateUserDraftRequirements.mockReturnValue(true);
    mocks.validateFacultyDraft.mockReturnValue(null);
    mocks.syncUserAccount.mockResolvedValue(true);
    mocks.isEmployeeIdConflictError.mockReturnValue(false);
  });

  it("does not write the user account when the faculty write fails", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("conflict");
    });

    const saved = await runFacultySaveFlow(input({ onSave }));

    expect(saved).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mocks.syncUserAccount).not.toHaveBeenCalled();
    expect(mocks.notifyFacultySaveFailed).toHaveBeenCalled();
  });

  it("saves the faculty record before syncing the account", async () => {
    const order: string[] = [];
    const onSave = vi.fn(async () => {
      order.push("faculty");
    });
    mocks.syncUserAccount.mockImplementation(async () => {
      order.push("account");
      return true;
    });

    const saved = await runFacultySaveFlow(input({ onSave }));

    expect(saved).toBe(true);
    expect(order).toEqual(["faculty", "account"]);
  });

  it("keeps the form open and reports a partial save when the account sync fails", async () => {
    const onSave = vi.fn(async () => undefined);
    mocks.syncUserAccount.mockResolvedValue(false);
    const onClose = vi.fn();

    const saved = await runFacultySaveFlow(input({ onSave, onClose }));

    expect(saved).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
