import { useState } from "react";
import { useContactById } from "@/tenant/hooks/collections/contacts";
import { formatContactGenderLabel } from "@mms/fe-core/lib/contactI18n";
import { formatDate, todayISO, type Student } from "@mms/contracts";
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

  // Stamp "today" once per form mount (lazy init) instead of calling `todayISO()`
  // (Date.now) during every render — the registration-date fallback is fixed when
  // the form opens, and render-time clock reads break React Compiler purity.
  const [fallbackRegisteredDate] = useState(() => todayISO().split("T")[0]);

  const { data: nextGrNumber } = useStudentNextGrNumber({
    registeredDate: (studentDraft.registeredDate || fallbackRegisteredDate).split("T")[0],
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
