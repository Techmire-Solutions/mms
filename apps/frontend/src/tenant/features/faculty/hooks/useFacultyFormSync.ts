import { useEffect } from "react";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export interface FacultyFormAssignableRolesSyncProps {
  facultyDraft?: { designationAssignableRoles?: string[] };
  userAccountDraft: FacultyUserAccountDraft;
  setUserAccountDraft: React.Dispatch<React.SetStateAction<FacultyUserAccountDraft>>;
}

/**
 * Keeps the user-account role draft inside the designation's assignable roles.
 */
export function useFacultyAssignableRolesSync({
  facultyDraft,
  userAccountDraft,
  setUserAccountDraft,
}: FacultyFormAssignableRolesSyncProps): void {
  const draft = facultyDraft ?? {};

  useEffect(() => {
    const allowedRoles = draft.designationAssignableRoles;
    if (allowedRoles && allowedRoles.length > 0 && userAccountDraft.role) {
      if (!allowedRoles.includes(userAccountDraft.role)) {
        setUserAccountDraft((prev) => ({
          ...prev,
          role: allowedRoles[0],
        }));
      }
    }
  }, [draft.designationAssignableRoles, userAccountDraft.role, setUserAccountDraft]);
}
