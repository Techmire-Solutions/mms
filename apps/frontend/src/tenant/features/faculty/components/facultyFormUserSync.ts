import { notify } from "@/lib/notify";
import { apiContract } from "@/lib/api";
import { DEFAULT_FACULTY_USER_ROLE, type FacultyMember } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";
import { reportClientError } from "@/lib/clientErrorReporting";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export function notifyFacultySaveFailed(t: TranslationFunction, err: unknown, scope: string): void {
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
}

/** Commit the stashed draft after the user confirms "save anyway". */
export async function confirmPendingFacultySave(
  input: ConfirmPendingFacultySaveInput,
): Promise<void> {
  if (!input.pendingSaveData) return;
  input.setSaving(true);
  try {
    const userOk = await syncUserAccount({
      userAccountDraft: input.userAccountDraft,
      linkedUser: input.linkedUser,
      contactId: input.pendingSaveData.contactId,
      payload: input.pendingSaveData as Record<string, unknown>,
      t: input.t,
      setErrors: input.setErrors || (() => {}),
      onUserInvalidate: input.onUserInvalidate,
    });
    if (!userOk) {
      input.setDuplicateConfirmOpen(false);
      input.setSaving(false);
      return;
    }

    await input.onSave(input.pendingSaveData as FacultyMember);
    input.setPendingSaveData(null);
    input.setDuplicateConfirmOpen(false);
    input.onClose();
  } catch (err: unknown) {
    input.setDuplicateConfirmOpen(false);
    notifyFacultySaveFailed(input.t, err, "faculty.form_save_confirm");
  } finally {
    input.setSaving(false);
  }
}
