/** Orchestrator FormModal for configuring Class General Rules, Fees, Schedules, Budgets, Scholarships. */
import React, { useMemo, useState } from "react";
import { GraduationCap } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useFacultyContractList, useFacultyByIds } from "@/tenant/hooks/collections/faculty";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { FACULTY_MODULE_MANIFEST, formatFacultyDisplayName, type FacultyMember } from "@mms/shared";
import type { Class } from "@/lib/data/sessionsData";
import {
  CLASS_DETAIL_TABS,
  ClassDetailSectionsTab,
  type ClassDetailTabId,
  useClassDetailDraft,
} from "./class-detail";
import { useAcademicTerms } from "@/hooks/useAcademicTerms";
import { ClassDetailTabBody } from "./ClassDetailTabBody";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { validateClassDraft } from "./class-detail/classDetailValidation";

interface ClassDetailModalProps {
  open: boolean;
  sessionClass: Class | null;
  onClose: () => void;
  onSave: (updatedClass: Class) => boolean | void | Promise<boolean | void>;
  saving?: boolean;
}

export function ClassDetailModal({
  open,
  sessionClass,
  onClose,
  onSave,
  saving = false,
}: ClassDetailModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const terms = useAcademicTerms();
  const { activeCurrency } = useFinanceCurrency();
  const currencySymbol = activeCurrency?.symbol || "";
  const [activeTab, setActiveTab] = useState<ClassDetailTabId>("general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: facultyData } = useFacultyContractList(
    { page: 1, limit: FACULTY_MODULE_MANIFEST.maxPageSize, status: "active" },
    open,
  );
  const facultyList = useMemo(
    () => (facultyData?.body?.faculty ?? []) as FacultyMember[],
    [facultyData?.body?.faculty],
  );

  const {
    classDraft,
    updateDraft,
    addFeeRow,
    removeFeeRow,
    updateFeeRow,
    addDiscountRow,
    removeDiscountRow,
    updateDiscountRow,
    addScheduleRow,
    removeScheduleRow,
    updateScheduleRow,
    activeTimetable,
    addPeriodRow,
    removePeriodRow,
    updatePeriodRow,
    addBudgetRow,
    removeBudgetRow,
    updateBudgetRow,
    addRefreshmentRow,
    removeRefreshmentRow,
    updateRefreshmentRow,
    activeScholarship,
    updateScholarship,
    updateEligibility,
  } = useClassDetailDraft({ open, sessionClass, allFaculty: facultyList });
  const { isDirty } = useDirtySnapshot(classDraft, `${open}|${sessionClass?.id ?? "new"}`);

  // Ensure a faculty member assigned outside the active page is still resolved by id.
  const activeFacultyId = classDraft.facultyId;
  const selectedFacultyId = activeFacultyId ? [activeFacultyId] : [];
  const { data: selectedFacultyData } = useFacultyByIds(selectedFacultyId);
  const selectedFaculty = useMemo(
    () => (selectedFacultyData ?? []) as FacultyMember[],
    [selectedFacultyData],
  );

  const allFaculty = useMemo(() => {
    const map = new Map<string, FacultyMember>();
    for (const member of facultyList) {
      if (member?.id) map.set(String(member.id), member);
    }
    for (const member of selectedFaculty) {
      if (member?.id && !map.has(String(member.id))) {
        map.set(String(member.id), member);
      }
    }
    return Array.from(map.values());
  }, [facultyList, selectedFaculty]);

  const formTabs = useMemo(
    () =>
      CLASS_DETAIL_TABS.map((tab) => ({
        key: tab.id,
        label: tab.id === "sections" ? terms.section.plural : t(tab.labelKey),
        icon: tab.icon,
      })),
    [t, terms],
  );

  // Every (re)open starts on the General tab with no errors (render-phase reset, no effect).
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevSessionClass, setPrevSessionClass] = useState(sessionClass);
  if (prevOpen !== open || prevSessionClass !== sessionClass) {
    setPrevOpen(open);
    setPrevSessionClass(sessionClass);
    if (open) {
      setActiveTab("general");
      setErrors({});
      setServerError(null);
    }
  }

  const handleSave = async () => {
    setServerError(null);
    const validation = validateClassDraft(classDraft, t);
    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      setActiveTab(validation.tab);
      return false;
    }
    setErrors({});

    const activeFacultyId = classDraft.facultyId;
    let resolvedFacultyName = classDraft.facultyName;
    if (activeFacultyId) {
      const member = allFaculty.find(
        (candidate) => String(candidate.id) === String(activeFacultyId),
      );
      if (member) {
        resolvedFacultyName = formatFacultyDisplayName(member) || resolvedFacultyName;
      }
    }

    try {
      const saved = await onSave({
        ...classDraft,
        facultyId: activeFacultyId,
        facultyName: resolvedFacultyName,
      });
      return saved !== false;
    } catch (error) {
      const mapped = mapApiFormError(error);
      if (mapped.fieldErrors) setErrors(mapped.fieldErrors);
      setServerError(mapped.message ?? t("settings.serverSaveFailed"));
      return false;
    }
  };

  return (
    <FormModal<ClassDetailTabId>
      open={open}
      onClose={onClose}
      title={
        classDraft.name
          ? t("sessions.classes.detail.title", { name: classDraft.name })
          : t("sessions.classes.detail.newTitle")
      }
      icon={GraduationCap}
      tall
      size="xl"
      tabs={formTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saveOnTabChange={false}
      saving={saving}
      saveDisabled={saving || !classDraft.name?.trim()}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("enrollments.ops.discardDescription")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      error={[Object.values(errors)[0], serverError].filter(Boolean).join(" · ") || undefined}
      formId="class-detail-modal-form"
    >
      <form
        id="class-detail-modal-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
        className="w-full space-y-3"
      >
        {activeTab === "sections" ? (
          <ClassDetailSectionsTab
            classId={classDraft.id}
            sections={classDraft.sections ?? []}
            savedSectionIds={new Set((sessionClass?.sections ?? []).map((section) => section.id))}
            allFaculty={allFaculty}
            onChange={(sections) => updateDraft("sections", sections)}
          />
        ) : (
          <ClassDetailTabBody
            activeTab={activeTab}
            classDraft={classDraft}
            updateDraft={updateDraft}
            errors={errors}
            allFaculty={allFaculty}
            currencySymbol={currencySymbol}
            addFeeRow={addFeeRow}
            removeFeeRow={removeFeeRow}
            updateFeeRow={updateFeeRow}
            addDiscountRow={addDiscountRow}
            removeDiscountRow={removeDiscountRow}
            updateDiscountRow={updateDiscountRow}
            addScheduleRow={addScheduleRow}
            removeScheduleRow={removeScheduleRow}
            updateScheduleRow={updateScheduleRow}
            activeTimetable={activeTimetable}
            addPeriodRow={addPeriodRow}
            removePeriodRow={removePeriodRow}
            updatePeriodRow={updatePeriodRow}
            addBudgetRow={addBudgetRow}
            removeBudgetRow={removeBudgetRow}
            updateBudgetRow={updateBudgetRow}
            addRefreshmentRow={addRefreshmentRow}
            removeRefreshmentRow={removeRefreshmentRow}
            updateRefreshmentRow={updateRefreshmentRow}
            activeScholarship={activeScholarship}
            updateScholarship={updateScholarship}
            updateEligibility={updateEligibility}
          />
        )}
      </form>
    </FormModal>
  );
}
