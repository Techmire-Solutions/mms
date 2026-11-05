import React from "react";
import { Calendar } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { type Session } from "@/lib/data/sessionsData";
import {
  SessionDetailsSection,
  SessionFinancialSection,
} from "@/tenant/features/sessions/components/SessionFormSections";
import { SessionFormFooter } from "@/tenant/features/sessions/components/SessionFormFooter";
import { SessionScheduleSection } from "@/tenant/features/sessions/components/SessionScheduleSection";
import { SessionCompletionCriteriaSection } from "@/tenant/features/sessions/components/SessionCompletionCriteriaSection";
import { useSessionFormController } from "@/tenant/features/sessions/hooks/useSessionFormController";

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
    defaultCurrency,
    saving,
    errors,
    sessionDraft,
    updateDraft,
    isDirty,
    handleSave,
    statusOptions,
    structureLocked,
    defaultCategoryId,
    canCreateCatalog,
    currencyOptions,
  } = useSessionFormController({ session, onClose, onSave });

  const errorEntries = Object.entries(errors);
  const fieldIdForError = (key: string): string => {
    const ids: Record<string, string> = {
      name: "session-name",
      startDate: "session-start-date",
      endDate: "session-end-date",
      baseFee: "session-baseFee",
      minAttendancePct: "session-minAttendancePct",
    };
    return ids[key] ?? `session-${key}`;
  };

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
      error={errorEntries.map(([, message]) => message)}
      onSelectError={(index) => {
        const entry = errorEntries[index];
        if (!entry) return;
        const field = document.getElementById(fieldIdForError(entry[0]));
        field?.scrollIntoView({ block: "center" });
        (field as HTMLElement | null)?.focus();
      }}
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
          startDate={sessionDraft.startDate}
          endDate={sessionDraft.endDate}
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
          defaultCategoryId={defaultCategoryId}
          structureLocked={structureLocked}
          canCreateCatalog={canCreateCatalog}
          statusOptions={statusOptions}
          onDraftChange={updateDraft}
        />
        <SessionScheduleSection sessionDraft={sessionDraft} onDraftChange={updateDraft} />
        <SessionFinancialSection
          sessionDraft={sessionDraft}
          errors={errors}
          currencyOptions={currencyOptions}
          defaultCurrency={defaultCurrency}
          onDraftChange={updateDraft}
        />
        <SessionCompletionCriteriaSection
          sessionDraft={sessionDraft}
          errors={errors}
          onDraftChange={updateDraft}
        />
      </form>
    </FormModal>
  );
};
