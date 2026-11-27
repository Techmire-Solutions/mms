import React, { useState } from "react";
import { SessionClassSectionSelect } from "../host/SessionClassSectionSelect";
import { sessionIdForClass } from "../host/SessionClassSectionSelectHelpers";
import { useSessionsCollection } from "../host/useSessionsCollection";
import { useTranslation } from "@mms/fe-core/i18n";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import { FORM_INPUT, WORK_SURFACE } from "@mms/ui";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { Input } from "@mms/ui";
import { Textarea } from "@mms/ui";
import { coercePaperNumberInput, type PaperConfig } from "../lib/paperBuilderUtils";

interface PaperDetailsFormProps {
  config: PaperConfig;
  onChange: <Field extends keyof PaperConfig>(field: Field, value: PaperConfig[Field]) => void;
  /** Write-schema issues for the fields this panel owns. */
  errors?: Record<string, string>;
}

export function PaperDetailsForm({
  config,
  onChange,
  errors = {},
}: PaperDetailsFormProps): React.ReactElement {
  const { t } = useTranslation();
  const sessions = useSessionsCollection();
  const [sessionId, setSessionId] = useState(() => sessionIdForClass(sessions, config.classId));

  // Loading a saved paper (or picking another class) must re-derive its session.
  useIdentityReset(`${config.classId ?? ""}:${sessions.length}`, () => {
    setSessionId(sessionIdForClass(sessions, config.classId));
  });

  return (
    <section className={`${WORK_SURFACE} p-3 sm:p-4`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2">
          <Field id="paper-name" label={t("questionBank.paperName")} required error={errors.name}>
            <Input
              id="paper-name"
              name="name"
              className={`${FORM_INPUT} shadow-none`}
              value={config.name}
              onChange={(event: any) => onChange("name", event.target.value)}
              placeholder={t("questionBank.paperNamePlaceholder")}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2 md:col-span-4">
          <SessionClassSectionSelect
            sessions={sessions}
            value={{
              sessionId: sessionId || sessionIdForClass(sessions, config.classId),
              classId: config.classId,
              sectionId: "",
            }}
            idPrefix="paper-link"
            onChange={(next: any) => {
              setSessionId(next.sessionId);
              onChange("classId", next.classId);
              const cls = sessions
                .find((row: any) => row.id === next.sessionId)
                ?.classes.find((row: any) => row.id === next.classId);
              if (cls) onChange("examClass", cls.name);
            }}
          />
        </div>
        <div>
          <Field id="paper-class" label={t("questionBank.paperClass")}>
            <Input
              id="paper-class"
              name="examClass"
              className={`${FORM_INPUT} shadow-none`}
              value={config.examClass}
              onChange={(event: any) => onChange("examClass", event.target.value)}
              placeholder={t("questionBank.paperClassPlaceholder")}
            />
          </Field>
        </div>
        <div>
          <Field
            id="paper-duration"
            label={t("questionBank.durationMin")}
            required
            error={errors.duration}
          >
            <Input
              id="paper-duration"
              name="duration"
              type="text"
              inputMode="numeric"
              className={`${FORM_INPUT} shadow-none`}
              value={config.duration}
              onChange={(event: any) =>
                onChange("duration", coercePaperNumberInput(event.target.value, config.duration, 5))
              }
            />
          </Field>
        </div>
        <div>
          <Field
            id="paper-marks"
            label={t("questionBank.paperTotalMarks")}
            error={errors.totalMarks}
          >
            <Input
              id="paper-marks"
              name="totalMarks"
              type="text"
              inputMode="numeric"
              className={`${FORM_INPUT} shadow-none`}
              value={config.totalMarks}
              onChange={(event: any) =>
                onChange(
                  "totalMarks",
                  coercePaperNumberInput(event.target.value, config.totalMarks, 1),
                )
              }
            />
          </Field>
        </div>
        <div className="sm:col-span-2 md:col-span-3">
          <Field id="paper-instructions" label={t("questionBank.paperInstructions")}>
            <Textarea
              id="paper-instructions"
              name="instructions"
              className={`${FORM_INPUT} min-h-20 shadow-none`}
              value={config.instructions}
              onChange={(event: any) => onChange("instructions", event.target.value)}
              placeholder={t("questionBank.paperInstructionsPlaceholder")}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
