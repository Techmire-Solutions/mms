import { useEffect } from "react";
import { DEFAULT_FACULTY_USER_ROLE } from "@mms/contracts";
import type { FacultyUserAccountDraft } from "../components/FacultyUserAccountSection";

export interface FacultyFormAssignableRolesSyncProps {
  facultyDraft?: { designationAssignableRoles?: string[] };
  userAccountDraft: FacultyUserAccountDraft;
  setUserAccountDraft: React.Dispatch<React.SetStateAction<FacultyUserAccountDraft>>;
}

/**
 * Keeps the user-account role draft inside the designation's assignable roles,
 * and disables the account when the designation has no assignable role.
 */
export function useFacultyAssignableRolesSync({
  facultyDraft,
  userAccountDraft,
  setUserAccountDraft,
}: FacultyFormAssignableRolesSyncProps): void {
  const draft = facultyDraft ?? {};

  useEffect(() => {
    const allowedRoles = draft.designationAssignableRoles ?? [];
    const hasAssignableRole = allowedRoles.length > 0;

    // No assignable role → the login account cannot be granted. Clear a stale
    // `enabled` flag (and reset the role) so the disabled switch isn't stuck
    // "on" and save doesn't fail with roleNotAllowed.
    if (!hasAssignableRole) {
      if (userAccountDraft.enabled || userAccountDraft.role !== DEFAULT_FACULTY_USER_ROLE) {
        setUserAccountDraft((prev) => ({
          ...prev,
          enabled: false,
          role: DEFAULT_FACULTY_USER_ROLE,
        }));
      }
      return;
    }

    if (userAccountDraft.role && !allowedRoles.includes(userAccountDraft.role)) {
      setUserAccountDraft((prev) => ({ ...prev, role: allowedRoles[0] }));
    }
  }, [
    draft.designationAssignableRoles,
    userAccountDraft.role,
    userAccountDraft.enabled,
    setUserAccountDraft,
  ]);
}
