import { useContactById } from "@/tenant/hooks/collections/contacts";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import { formatDate, todayISO, type Student } from "@mms/shared";
import {
  useStudentLinkedContactIds,
  useStudentNextGrNumber,
} from "@/tenant/features/students/hooks/useStudents";
import { buildStudentContactExcludeIds } from "@/tenant/features/students/hooks/studentFormValidation";
import { isStudentCreate } from "@/tenant/features/students/hooks/studentFormHandlers";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface UseStudentFormLinkedDataOptions {
  student?: Partial<Student> | null;
  studentDraft: Partial<Student>;
  settings: {
    autoGenerateId?: boolean;
    grNumberTemplate?: string;
    grNumberDigits?: number;
    grNumberRestartAnnually?: boolean;
  };
  isGrManuallyEdited: boolean;
  setIsGrManuallyEdited: (val: boolean) => void;
  updateDraft: (patch: Partial<Student>) => void;
  t: TranslationFunction;
}

export function useStudentFormLinkedData({
  student,
  studentDraft,
  settings,
  isGrManuallyEdited,
  setIsGrManuallyEdited,
  updateDraft,
  t,
}: UseStudentFormLinkedDataOptions) {
  const autoGenerateId = settings.autoGenerateId !== false;

  const { data: linkedContact } = useContactById(
    studentDraft.contactId ? String(studentDraft.contactId) : undefined,
    !!studentDraft.contactId,
  );

  const linkedGenderRaw = linkedContact?.gender?.trim() || "";
  const linkedGenderLabel = linkedGenderRaw ? formatContactGenderLabel(linkedGenderRaw, t) : "";
  const linkedDob = linkedContact?.dob?.trim() ? formatDate(linkedContact.dob.trim()) : "";

  const { data: linkedStudentContactIds = [] } = useStudentLinkedContactIds(
    student?.id ? String(student.id) : undefined,
  );

  const { data: nextGrNumber } = useStudentNextGrNumber({
    registeredDate: (studentDraft.registeredDate || todayISO()).split("T")[0],
    template: settings.grNumberTemplate,
    digits: settings.grNumberDigits,
    restartAnnually: settings.grNumberRestartAnnually,
    enabled: isStudentCreate(student) && autoGenerateId,
  });

  const handleGrNumberChange = (value: string) => {
    setIsGrManuallyEdited(true);
    updateDraft({ grNumber: value });
  };

  const excludeIds = (() =>
    buildStudentContactExcludeIds(linkedStudentContactIds, linkedContact))();

  const isGrAutoAssigned = autoGenerateId && isStudentCreate(student) && !isGrManuallyEdited;

  return {
    linkedContact,
    linkedGenderRaw,
    linkedGenderLabel,
    linkedDob,
    nextGrNumber,
    autoGenerateId,
    handleGrNumberChange,
    excludeIds,
    isGrAutoAssigned,
  };
}
