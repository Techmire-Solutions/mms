import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, UserPlus, X } from "lucide-react";
import type { SystemUser } from "@mms/shared";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/button";
import { ADD_USER_MODAL_STEP_DEFS, StepIndicator } from "./AddUserModalStepIndicator";
import { Step1 } from "./AddUserModalStep1";
import { Step2 } from "./AddUserModalStep2";
import { Step3 } from "./AddUserModalStep3";
import { useAddUserModalForm } from "./useAddUserModalForm";
import { AddUserSuccessView } from "./AddUserSuccessView";

export interface AddUserModalProps {
  onClose: () => void;
  onAdd: (user: SystemUser) => void | Promise<void>;
  existingEmails?: string[];
}

export function AddUserModal({
  onClose,
  onAdd,
  existingEmails = [],
}: AddUserModalProps): React.JSX.Element {
  const {
    t,
    step,
    submitting,
    success,
    errors,
    form,
    setForm,
    handleNext,
    handleBack,
    handleSubmit,
  } = useAddUserModalForm({ onAdd, onClose, existingEmails });

  return (
    <FormModal
      open
      onClose={onClose}
      title={t("users.addTitle")}
      subtitle={t("users.addSubtitle")}
      icon={UserPlus}
      size="lg"
      hideFooter
    >
      {success ? (
        <AddUserSuccessView form={form} t={t} />
      ) : (
        <>
          <StepIndicator step={step} />
          <form
            id="add-user-modal-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step < 3) {
                handleNext();
              } else {
                void handleSubmit();
              }
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                {step === 1 && <Step1 form={form} setForm={setForm} errors={errors} />}
                {step === 2 && <Step2 form={form} setForm={setForm} errors={errors} />}
                {step === 3 && <Step3 form={form} setForm={setForm} errors={errors} />}
              </motion.div>
            </AnimatePresence>
          </form>
          <div className="mt-6 flex w-full items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={step === 1 ? onClose : handleBack}
            >
              {step === 1 ? <X className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              {step === 1 ? t("users.cancel") : t("users.addBack")}
            </Button>
            <div className="flex items-center gap-1.5">
              {ADD_USER_MODAL_STEP_DEFS.map((stepDefinition) => (
                <div
                  key={stepDefinition.id}
                  className={`h-1.5 rounded-full transition-all ${
                    step === stepDefinition.id
                      ? "w-3 bg-primary"
                      : step > stepDefinition.id
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-border"
                  }`}
                />
              ))}
            </div>
            {step < 3 ? (
              <Button
                type="submit"
                form="add-user-modal-form"
                className="min-h-11"
                onClick={(event) => {
                  event.preventDefault();
                  handleNext();
                }}
              >
                {t("users.addNext")} <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="add-user-modal-form"
                className="min-h-11"
                onClick={(event) => {
                  event.preventDefault();
                  void handleSubmit();
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                {submitting ? t("users.addCreating") : t("users.addCreate")}
              </Button>
            )}
          </div>
        </>
      )}
    </FormModal>
  );
}
