import React from "react";
import { FormModal } from "@/components/ui/FormModal";
import { useTranslation } from "@/hooks/useTranslation";
import { useWakalaFormModalState } from "./wakala/useWakalaFormModalState";
import { WakalaStepProgressBar } from "./wakala/WakalaStepProgressBar";
import { WakalaStep1MujtahidType } from "./wakala/WakalaStep1MujtahidType";
import { WakalaStep2Representative } from "./wakala/WakalaStep2Representative";
import { WakalaStep3Distribution } from "./wakala/WakalaStep3Distribution";
import { WakalaQuickCreateModals } from "./wakala/WakalaQuickCreateModals";
import type { WakalaFormModalProps, InitialDistRow } from "./wakala/wakalaFormModalTypes";

export type { WakalaFormModalProps, InitialDistRow };

export function WakalaFormModal(props: WakalaFormModalProps): React.JSX.Element {
  const {
    title,
    mujtahids,
    obligationTypes,
    onClose,
    onChangeMujtahids,
    onChangeReps,
    onChangeTypes,
  } = props;
  const { t } = useTranslation();

  const state = useWakalaFormModalState(props);

  const errorsList = Object.values(state.errors).filter(Boolean);
  const allErrors = state.submitError ? [...errorsList, state.submitError] : errorsList;

  return (
    <>
      <FormModal
        open={!state.isChildModalOpen}
        onClose={onClose}
        title={title}
        cancelLabel={state.step === 1 ? t("common.cancel") : "Back"}
        saveLabel={state.step === 3 ? t("common.save") : "Next"}
        onSave={state.handleNextOrSave}
        saving={state.saving}
        saveDisabled={
          state.saving ||
          (state.step === 1 && (!state.selectedMujtahidId || !state.selectedObTypeId)) ||
          (state.step === 2 && !state.selectedRepId) ||
          (state.step === 3 && state.totalPercentage > 100)
        }
        error={allErrors.length > 0 ? allErrors : undefined}
        formId="wakala-form-modal"
      >
        <form
          id="wakala-form-modal"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void state.handleNextOrSave();
          }}
          className="space-y-3"
        >
          <WakalaStepProgressBar
            step={state.step}
            onSetStep={state.setStep}
            validateStep1={state.validateStep1}
            validateStep2={state.validateStep2}
          />

          {state.step === 1 && (
            <WakalaStep1MujtahidType
              selectedMujtahidId={state.selectedMujtahidId}
              selectedObTypeId={state.selectedObTypeId}
              mujtahids={mujtahids}
              obligationTypes={obligationTypes}
              errors={state.errors}
              onSelectMujtahid={(val) => {
                state.setSelectedMujtahidId(val);
                state.setSelectedRepId("");
                state.setErrors((prev) => ({ ...prev, mujtahid: "" }));
              }}
              onSelectObType={(val) => {
                state.setSelectedObTypeId(val);
                state.setErrors((prev) => ({ ...prev, obType: "" }));
              }}
              canAddMujtahid={Boolean(onChangeMujtahids)}
              canAddObType={Boolean(onChangeTypes)}
              onOpenAddMujtahid={() => state.setIsAddMujtahidOpen(true)}
              onOpenAddObType={() => state.setIsAddObTypeOpen(true)}
            />
          )}

          {state.step === 2 && (
            <WakalaStep2Representative
              selectedMujtahid={state.selectedMujtahid}
              selectedObType={state.selectedObType}
              selectedRepId={state.selectedRepId}
              availableReps={state.availableReps}
              errors={state.errors}
              onSelectRep={(val) => {
                state.setSelectedRepId(val);
                state.setErrors((prev) => ({ ...prev, rep: "" }));
              }}
              canAddRep={Boolean(onChangeReps)}
              onOpenAddRep={() => state.setIsAddRepOpen(true)}
            />
          )}

          {state.step === 3 && (
            <WakalaStep3Distribution
              selectedObType={state.selectedObType}
              selectedRep={state.selectedRep}
              selectedMujtahid={state.selectedMujtahid}
              initialDistributions={state.initialDistributions}
              totalPercentage={state.totalPercentage}
              onAddRow={state.addDistributionRow}
              onRemoveRow={state.removeDistributionRow}
              onUpdateRow={state.updateDistributionRow}
            />
          )}
        </form>
      </FormModal>

      <WakalaQuickCreateModals
        isAddMujtahidOpen={state.isAddMujtahidOpen}
        onCloseAddMujtahid={() => state.setIsAddMujtahidOpen(false)}
        onSaveMujtahid={state.handleSaveMujtahid}
        isAddRepOpen={state.isAddRepOpen}
        onCloseAddRep={() => state.setIsAddRepOpen(false)}
        onSaveRep={state.handleSaveRep}
        isAddObTypeOpen={state.isAddObTypeOpen}
        onCloseAddObType={() => state.setIsAddObTypeOpen(false)}
        onSaveObType={state.handleSaveObType}
      />
    </>
  );
}
