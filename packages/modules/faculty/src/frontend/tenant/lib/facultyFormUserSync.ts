import { notify } from "@mms/fe-core/notify";
import { apiContract } from "@mms/fe-core/api/tsRest";
import { apiErrorMessage } from "@mms/fe-core/api/errorMessage";
import { isConflictError } from "@mms/fe-core/api/contractError";
import { DEFAULT_FACULTY_USER_ROLE, type FacultyMember } from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { getApiValidationMessage } from "@mms/fe-core/api/validationMessage";
import { reportClientError } from "@mms/fe-core/reporting/clientErrorReporting";
import type { FacultyUserAccountDraft } from "../components/FacultyUserAccountSection";

export function notifyFacultySaveFailed(t: TranslationFunction, err: unknown, scope: string): void {
  // A stale OCC token is a conflict, not a generic failure: name it, keep the
  // server's explanation, and leave the form open so the user can reload.
  if (isConflictError(err)) {
    const conflictMessage = getApiValidationMessage(err) ?? apiErrorMessage(err, "");
    notify.error(
      t("faculty.toast.conflict"),
      conflictMessage ? { description: conflictMessage } : undefined,
    );
    reportClientError(err, { scope });
    return;
  }
  const validationMessage = getApiValidationMessage(err);
  notify.error(
    t("faculty.toast.saveFailed"),
    validationMessage ? { description: validationMessage } : undefined,
  );
  reportClientError(err, { scope });
}

export interface SyncUserAccountInput {
  userAccountDraft?: FacultyUserAccountDraft;
  linkedUser?: { id: string; role?: string } | null;
  contactId?: string | number;
  payload: Record<string, unknown>;
  t: TranslationFunction;
  setErrors: (errors: Record<string, string>) => void;
  onUserInvalidate?: () => void;
}

/** Synchronize linked user account or create a new user with chosen workspace role. */
export async function syncUserAccount(input: SyncUserAccountInput): Promise<boolean> {
  const { userAccountDraft, linkedUser, contactId, payload, t, setErrors, onUserInvalidate } =
    input;

  if (linkedUser) {
    payload.userId = linkedUser.id;
    if (
      userAccountDraft?.enabled &&
      userAccountDraft.role &&
      userAccountDraft.role !== linkedUser.role
    ) {
      const updateRes = await apiContract.users.update({
        params: { id: linkedUser.id },
        body: { role: userAccountDraft.role },
      });
      if (updateRes.status !== 200) {
        const msg =
          typeof updateRes.body === "object" &&
          updateRes.body !== null &&
          "message" in updateRes.body
            ? String((updateRes.body as { message?: unknown }).message)
            : t("faculty.toast.saveFailed");
        setErrors({ "user.role": msg });
        notify.error(msg);
        return false;
      }
      onUserInvalidate?.();
    }
    return true;
  }

  if (userAccountDraft?.enabled) {
    const createRes = await apiContract.users.create({
      body: {
        contactId: String(contactId || ""),
        role: userAccountDraft.role || DEFAULT_FACULTY_USER_ROLE,
        status: userAccountDraft.setupMethod === "invite" ? "inactive" : "active",
        setupMethod: userAccountDraft.setupMethod,
        password: userAccountDraft.password,
        forceReset: userAccountDraft.forceReset !== false,
        twoFactorEnabled: false,
      },
    });

    if (createRes.status !== 200) {
      const msg =
        typeof createRes.body === "object" && createRes.body !== null && "message" in createRes.body
          ? String((createRes.body as { message?: unknown }).message)
          : t("faculty.toast.saveFailed");
      setErrors({ "user.create": msg });
      notify.error(msg);
      return false;
    }

    const created = (createRes.body as { user?: { id: string } }).user;
    if (created?.id) {
      payload.userId = created.id;
    }
    onUserInvalidate?.();
    return true;
  }

  return true;
}

export interface ConfirmPendingFacultySaveInput {
  pendingSaveData: Partial<FacultyMember> | null;
  faculty?: FacultyMember;
  t: TranslationFunction;
  onSave: (faculty: FacultyMember) => void | Promise<void>;
  onClose: () => void;
  setSaving: (saving: boolean) => void;
  setPendingSaveData: (data: Partial<FacultyMember> | null) => void;
  setDuplicateConfirmOpen: (open: boolean) => void;
  userAccountDraft?: FacultyUserAccountDraft;
  linkedUser?: { id: string; role?: string } | null;
  onUserInvalidate?: () => void;
  setErrors?: (errors: Record<string, string>) => void;
  /**
   * Called with the original error when the record write fails, so the caller can
   * map field errors into its own form state. The pending draft and the confirm
   * dialog are kept open on that path so the user can retry.
   */
  onError?: (error: unknown) => void;
}

/** Commit the stashed draft after the user confirms "save anyway". */
export async function confirmPendingFacultySave(
  input: ConfirmPendingFacultySaveInput,
): Promise<boolean> {
  if (!input.pendingSaveData) return false;
  input.setSaving(true);
  try {
    // Same ordering as the main flow: record first, account second.
    await input.onSave(input.pendingSaveData as FacultyMember);

    let userOk = true;
    try {
      userOk = await syncUserAccount({
        userAccountDraft: input.userAccountDraft,
        linkedUser: input.linkedUser,
        contactId: input.pendingSaveData.contactId,
        payload: input.pendingSaveData as Record<string, unknown>,
        t: input.t,
        setErrors: input.setErrors || (() => {}),
        onUserInvalidate: input.onUserInvalidate,
      });
    } catch {
      userOk = false;
    }
    if (!userOk) {
      notify.warning(input.t("faculty.toast.savedAccountFailed"));
      input.setPendingSaveData(null);
      input.setDuplicateConfirmOpen(false);
      return false;
    }

    input.setPendingSaveData(null);
    input.setDuplicateConfirmOpen(false);
    input.onClose();
    return true;
  } catch (err: unknown) {
    // Keep the pending draft + dialog open: the retry must not lose the draft.
    notifyFacultySaveFailed(input.t, err, "faculty.form_save_confirm");
    input.onError?.(err);
    return false;
  } finally {
    input.setSaving(false);
  }
}
