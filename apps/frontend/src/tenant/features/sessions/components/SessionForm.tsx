import React from "react";
import { Calendar } from "lucide-react";
import { FormModal } from "@/components/ui/FormModal";
import { type Session } from "@/lib/data/sessionsData";
import {
  SessionDetailsSection,
  SessionFinancialSection,
} from "@/tenant/features/sessions/components/SessionFormSections";
import { SessionFormFooter } from "@/tenant/features/sessions/components/SessionFormFooter";
import { useSessionFormController } from "@/tenant/features/sessions/components/useSessionFormController";

export interface SessionFormProps {
  open?: boolean;
  session?: Session | null;
  onClose: () => void;
  onSave: (session: Session) => void | Promise<void>;
}

export const SessionForm = function SessionForm({
  open = true,
  session,
  onClose,
  onSave,
}: SessionFormProps): React.JSX.Element {
  const {
    t,
    language,
    defaultType,
    defaultCurrency,
    saving,
    errors,
    sessionDraft,
    updateDraft,
    isDirty,
    handleSave,
    sessionTypeOptions,
    statusOptions,
    currencyOptions,
  } = useSessionFormController({ session, onClose, onSave });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={session ? t("sessions.form.editTitle") : t("sessions.form.addTitle")}
      subtitle={t("sessions.form.subtitle")}
      icon={Calendar}
      lang={language}
      cancelLabel={t("common.cancel")}
      saveLabel={session ? t("sessions.action.update") : t("sessions.action.create")}
      onSave={handleSave}
      isDirty={isDirty}
      saving={saving}
      error={Object.values(errors)[0]}
      saveDisabled={
        !sessionDraft.name?.trim() ||
        !sessionDraft.startDate ||
        !sessionDraft.endDate ||
        (Boolean(session?.id) && !isDirty)
      }
      footerStart={
        <SessionFormFooter
          sessionName={sessionDraft.name}
          sessionType={sessionDraft.type}
          sessionStatus={sessionDraft.status}
          nameRequiredLabel={t("sessions.form.nameRequired")}
        />
      }
      formId="session-form"
    >
      <form
        id="session-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (
            sessionDraft.name?.trim() &&
            sessionDraft.startDate &&
            sessionDraft.endDate &&
            !(Boolean(session?.id) && !isDirty)
          ) {
            void handleSave();
          }
        }}
        className="space-y-4"
      >
        <SessionDetailsSection
          sessionDraft={sessionDraft}
          errors={errors}
          defaultType={defaultType}
          sessionTypeOptions={sessionTypeOptions}
          statusOptions={statusOptions}
          onDraftChange={updateDraft}
        />
        <SessionFinancialSection
          sessionDraft={sessionDraft}
          errors={errors}
          currencyOptions={currencyOptions}
          defaultCurrency={defaultCurrency}
          onDraftChange={updateDraft}
        />
      </form>
    </FormModal>
  );
};
