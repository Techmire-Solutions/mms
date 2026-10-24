import type { FacultyMember } from "@mms/shared";
import {
  type ClassDetailTabId,
  ClassDetailGeneralTab,
  ClassDetailFeesTab,
  ClassDetailScheduleTab,
  ClassDetailBudgetTab,
  ClassDetailScholarshipTab,
  type useClassDetailDraft,
} from "./class-detail";

type DraftHookResult = ReturnType<typeof useClassDetailDraft>;

export interface ClassDetailTabBodyProps {
  activeTab: ClassDetailTabId;
  classDraft: DraftHookResult["classDraft"];
  updateDraft: DraftHookResult["updateDraft"];
  errors: Record<string, string>;
  allFaculty: FacultyMember[];
  currencySymbol: string;
  addFeeRow: DraftHookResult["addFeeRow"];
  removeFeeRow: DraftHookResult["removeFeeRow"];
  updateFeeRow: DraftHookResult["updateFeeRow"];
  addDiscountRow: DraftHookResult["addDiscountRow"];
  removeDiscountRow: DraftHookResult["removeDiscountRow"];
  updateDiscountRow: DraftHookResult["updateDiscountRow"];
  addScheduleRow: DraftHookResult["addScheduleRow"];
  removeScheduleRow: DraftHookResult["removeScheduleRow"];
  updateScheduleRow: DraftHookResult["updateScheduleRow"];
  activeTimetable: DraftHookResult["activeTimetable"];
  addPeriodRow: DraftHookResult["addPeriodRow"];
  removePeriodRow: DraftHookResult["removePeriodRow"];
  updatePeriodRow: DraftHookResult["updatePeriodRow"];
  addBudgetRow: DraftHookResult["addBudgetRow"];
  removeBudgetRow: DraftHookResult["removeBudgetRow"];
  updateBudgetRow: DraftHookResult["updateBudgetRow"];
  addRefreshmentRow: DraftHookResult["addRefreshmentRow"];
  removeRefreshmentRow: DraftHookResult["removeRefreshmentRow"];
  updateRefreshmentRow: DraftHookResult["updateRefreshmentRow"];
  activeScholarship: DraftHookResult["activeScholarship"];
  updateScholarship: DraftHookResult["updateScholarship"];
  updateEligibility: DraftHookResult["updateEligibility"];
}

export function ClassDetailTabBody({
  activeTab,
  classDraft,
  updateDraft,
  errors,
  allFaculty,
  currencySymbol,
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
}: ClassDetailTabBodyProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {activeTab === "general" && (
        <ClassDetailGeneralTab
          classDraft={classDraft}
          updateDraft={updateDraft}
          errors={errors}
          allFaculty={allFaculty}
        />
      )}

      {activeTab === "fees" && (
        <ClassDetailFeesTab
          fees={classDraft.fees || []}
          discounts={classDraft.discounts || []}
          currencySymbol={currencySymbol}
          onAddFee={addFeeRow}
          onRemoveFee={removeFeeRow}
          onUpdateFee={updateFeeRow}
          onAddDiscount={addDiscountRow}
          onRemoveDiscount={removeDiscountRow}
          onUpdateDiscount={updateDiscountRow}
        />
      )}

      {activeTab === "schedule" && (
        <ClassDetailScheduleTab
          schedules={classDraft.schedules || []}
          periods={activeTimetable.periods || []}
          allFaculty={allFaculty}
          onAddSchedule={addScheduleRow}
          onRemoveSchedule={removeScheduleRow}
          onUpdateSchedule={updateScheduleRow}
          onAddPeriod={addPeriodRow}
          onRemovePeriod={removePeriodRow}
          onUpdatePeriod={updatePeriodRow}
        />
      )}

      {activeTab === "budget" && (
        <ClassDetailBudgetTab
          budgets={classDraft.budgets || []}
          refreshments={classDraft.refreshments || []}
          currencySymbol={currencySymbol}
          onAddBudget={addBudgetRow}
          onRemoveBudget={removeBudgetRow}
          onUpdateBudget={updateBudgetRow}
          onAddRefreshment={addRefreshmentRow}
          onRemoveRefreshment={removeRefreshmentRow}
          onUpdateRefreshment={updateRefreshmentRow}
        />
      )}

      {activeTab === "scholarship" && (
        <ClassDetailScholarshipTab
          scholarship={activeScholarship}
          onUpdateScholarship={updateScholarship}
          onUpdateEligibility={updateEligibility}
        />
      )}
    </div>
  );
}
