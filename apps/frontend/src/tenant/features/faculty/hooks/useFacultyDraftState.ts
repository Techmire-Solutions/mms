import { useCallback, useEffect, useState } from "react";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import {
  useFacultyLinkedContactIds,
  useFacultyNextEmployeeId,
} from "@/tenant/features/faculty/hooks/useFaculty";
import {
  type FacultyMember,
  type FacultySettings,
  getContactQualification,
  getContactSpecialization,
} from "@mms/shared";
import {
  DEFAULT_USER_ACCOUNT_DRAFT,
  extractEmployeeId,
  getInitialFacultyDraft,
  facultyDraftSnapshot,
} from "@/tenant/features/faculty/components/facultyFormDraft";
import type { FacultyUserAccountDraft } from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export interface UseFacultyDraftStateInput {
  faculty?: FacultyMember;
  defaultSpecialization: string;
  autoGenerateId: boolean;
  idPrefix: string;
  settings: FacultySettings;
}

export function useFacultyDraftState({
  faculty,
  defaultSpecialization,
  autoGenerateId,
  idPrefix,
  settings,
}: UseFacultyDraftStateInput) {
  const [facultyDraft, setFacultyDraft] = useState<Partial<FacultyMember>>(() =>
    getInitialFacultyDraft({ faculty, defaultSpecialization }),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    facultyDraftSnapshot(getInitialFacultyDraft({ faculty, defaultSpecialization })),
  );
  const [userAccountDraft, setUserAccountDraft] = useState<FacultyUserAccountDraft>(
    DEFAULT_USER_ACCOUNT_DRAFT,
  );

  useEffect(() => {
    const nextDraft = getInitialFacultyDraft({ faculty, defaultSpecialization });
    setFacultyDraft(nextDraft);
    setBaselineSnapshot(facultyDraftSnapshot(nextDraft));
    setUserAccountDraft(DEFAULT_USER_ACCOUNT_DRAFT);
  }, [faculty, defaultSpecialization]);

  const updateDraft = useCallback((patch: Partial<FacultyMember>) => {
    setFacultyDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const isDirty =
    facultyDraftSnapshot(facultyDraft) !== baselineSnapshot || userAccountDraft.enabled;

  const { data: linkedContact } = useContactById(
    facultyDraft.contactId ? String(facultyDraft.contactId) : undefined,
    Boolean(facultyDraft.contactId),
  );

  useEffect(() => {
    if (!linkedContact) return;
    const qual = getContactQualification(linkedContact);
    const spec = getContactSpecialization(linkedContact);
    setFacultyDraft((prev) => {
      const nextQual = qual || prev.qualification || "";
      const nextSpec = spec || prev.specialization || "";
      if (prev.qualification === nextQual && prev.specialization === nextSpec) return prev;
      return { ...prev, qualification: nextQual, specialization: nextSpec };
    });
  }, [linkedContact]);

  const { data: linkedFacultyContactIds = [] } = useFacultyLinkedContactIds(
    faculty?.id ? String(faculty.id) : undefined,
  );

  const {
    data: nextEmployeeId,
    refetch: refetchNextEmployeeId,
    isFetching: isFetchingNextEmployeeId,
  } = useFacultyNextEmployeeId({
    prefix: idPrefix,
    template: settings.idTemplate,
    digits: settings.employeeIdSequenceDigits ?? settings.idDigits,
    startSeq: settings.idStartSeq,
    restartAnnually: settings.idRestartAnnually,
    enabled: !faculty?.id && autoGenerateId,
  });

  const handleRegenerateEmployeeId = useCallback(async () => {
    const res = await refetchNextEmployeeId();
    const nextId = extractEmployeeId(res.data);
    if (nextId) setFacultyDraft((prev) => ({ ...prev, employeeId: nextId }));
  }, [refetchNextEmployeeId]);

  useEffect(() => {
    if (faculty?.id || !autoGenerateId) return;
    const resolved = extractEmployeeId(nextEmployeeId);
    if (!resolved || facultyDraft.employeeId) return;
    setFacultyDraft((prev) => {
      if (prev.employeeId) return prev;
      const nextDraft = { ...prev, employeeId: resolved };
      setBaselineSnapshot(facultyDraftSnapshot(nextDraft));
      return nextDraft;
    });
  }, [nextEmployeeId, faculty?.id, facultyDraft.employeeId, autoGenerateId]);

  return {
    facultyDraft,
    setFacultyDraft,
    baselineSnapshot,
    setBaselineSnapshot,
    updateDraft,
    isDirty,
    userAccountDraft,
    setUserAccountDraft,
    linkedContact,
    linkedFacultyContactIds,
    nextEmployeeId,
    isFetchingNextEmployeeId,
    handleRegenerateEmployeeId,
  };
}
