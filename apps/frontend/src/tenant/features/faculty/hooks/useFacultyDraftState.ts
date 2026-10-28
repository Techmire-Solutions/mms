import { useCallback, useState } from "react";
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
} from "@/tenant/features/faculty/lib/facultyFormDraft";
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
  const [prevFaculty, setPrevFaculty] = useState(faculty);
  const [prevDefaultSpec, setPrevDefaultSpec] = useState(defaultSpecialization);

  if (prevFaculty !== faculty || prevDefaultSpec !== defaultSpecialization) {
    setPrevFaculty(faculty);
    setPrevDefaultSpec(defaultSpecialization);
    const nextDraft = getInitialFacultyDraft({ faculty, defaultSpecialization });
    setFacultyDraft(nextDraft);
    setBaselineSnapshot(facultyDraftSnapshot(nextDraft));
    setUserAccountDraft(DEFAULT_USER_ACCOUNT_DRAFT);
  }

  const updateDraft = useCallback((patch: Partial<FacultyMember>) => {
    setFacultyDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const isDirty =
    facultyDraftSnapshot(facultyDraft) !== baselineSnapshot || userAccountDraft.enabled;

  const { data: linkedContact } = useContactById(
    facultyDraft.contactId ? String(facultyDraft.contactId) : undefined,
    Boolean(facultyDraft.contactId),
  );

  const [syncedContactId, setSyncedContactId] = useState<string | null>(null);
  const currentContactId = linkedContact ? String(linkedContact.id) : null;
  if (currentContactId && currentContactId !== syncedContactId) {
    setSyncedContactId(currentContactId);
    const qual = getContactQualification(linkedContact);
    const spec = getContactSpecialization(linkedContact);
    const nextQual = qual || facultyDraft.qualification || "";
    const nextSpec = spec || facultyDraft.specialization || "";
    if (facultyDraft.qualification !== nextQual || facultyDraft.specialization !== nextSpec) {
      setFacultyDraft((prev) => ({ ...prev, qualification: nextQual, specialization: nextSpec }));
    }
  }

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

  const [syncedEmployeeId, setSyncedEmployeeId] = useState<string | null>(null);
  const resolvedEmployeeId =
    !faculty?.id && autoGenerateId ? extractEmployeeId(nextEmployeeId) : null;
  if (resolvedEmployeeId && !facultyDraft.employeeId && resolvedEmployeeId !== syncedEmployeeId) {
    setSyncedEmployeeId(resolvedEmployeeId);
    const nextDraft = { ...facultyDraft, employeeId: resolvedEmployeeId };
    setFacultyDraft(nextDraft);
    setBaselineSnapshot(facultyDraftSnapshot(nextDraft));
  }

  const handleRegenerateEmployeeId = useCallback(async () => {
    const res = await refetchNextEmployeeId();
    const nextId = extractEmployeeId(res.data);
    if (nextId) setFacultyDraft((prev) => ({ ...prev, employeeId: nextId }));
  }, [refetchNextEmployeeId]);

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
