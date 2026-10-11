/** Orchestrator FormModal for configuring Class General Rules, Fees, Schedules, Budgets, Scholarships. */
import React, { useState, useEffect, useMemo } from "react";
import { GraduationCap, Calendar, Coffee, Award, Wallet } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useFacultyContractList, useFacultyByIds } from "@/tenant/hooks/collections/faculty";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { FACULTY_MODULE_MANIFEST, formatFacultyDisplayName, type FacultyMember } from "@mms/shared";
import type { Class } from "@/lib/data/sessionsData";
import {
  type ClassDetailTabId,
  type ClassDetailTabItem,
  useClassDetailDraft,
} from "./class-detail";
import { ClassDetailTabBody } from "./ClassDetailTabBody";

interface ClassDetailModalProps {
  open: boolean;
  sessionClass: Class | null;
  onClose: () => void;
  onSave: (updatedClass: Class) => void | Promise<void>;
  saving?: boolean;
}

const TABS: readonly ClassDetailTabItem[] = [
  { id: "general", labelKey: "sessions.classes.detail.tab.general", icon: GraduationCap },
  { id: "fees", labelKey: "sessions.classes.detail.tab.fees", icon: Wallet },
  { id: "schedule", labelKey: "sessions.classes.detail.tab.schedule", icon: Calendar },
  { id: "budget", labelKey: "sessions.classes.detail.tab.budget", icon: Coffee },
  { id: "scholarship", labelKey: "sessions.classes.detail.tab.scholarship", icon: Award },
];

export function ClassDetailModal({
  open,
  sessionClass,
  onClose,
  onSave,
  saving = false,
}: ClassDetailModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const { activeCurrency } = useFinanceCurrency();
  const currencySymbol = activeCurrency?.symbol || "";
  const [activeTab, setActiveTab] = useState<ClassDetailTabId>("general");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: facultyData } = useFacultyContractList(
    { page: 1, limit: FACULTY_MODULE_MANIFEST.maxPageSize, status: "active" },
    open,
  );
  const facultyList = (facultyData?.body?.faculty ?? []) as FacultyMember[];

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

  // Ensure a faculty member assigned outside the active page is still resolved by id.
  const activeFacultyId = classDraft.facultyId;
  const selectedFacultyId = activeFacultyId ? [activeFacultyId] : [];
  const { data: selectedFacultyData } = useFacultyByIds(selectedFacultyId);
  const selectedFaculty = (selectedFacultyData ?? []) as FacultyMember[];

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
    () => TABS.map((tab) => ({ key: tab.id, label: t(tab.labelKey), icon: tab.icon })),
    [t],
  );

  useEffect(() => {
    if (open) {
      setActiveTab("general");
      setErrors({});
    }
  }, [open, sessionClass]);

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!classDraft.name?.trim()) {
      newErrors.name = t("common.formPleaseFixErrors");
      setActiveTab("general");
    }
    if (classDraft.minAge > 0 && classDraft.maxAge > 0 && classDraft.minAge > classDraft.maxAge) {
      newErrors.maxAge = t("common.formPleaseFixErrors");
      setActiveTab("general");
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

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

    await onSave({
      ...classDraft,
      facultyId: activeFacultyId,
      facultyName: resolvedFacultyName,
    });
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
      saveOnTabChange={false}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saving || !classDraft.name?.trim()}
      error={Object.values(errors)[0]}
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
      </form>
    </FormModal>
  );
}
