import type React from "react";
import { Hash, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { extractEmployeeId } from "@/tenant/features/faculty/lib/facultyFormDraft";

export interface FacultyEmploymentEmployeeIdFieldProps {
  label: string;
  required: boolean;
  error?: string;
  employeeId?: string;
  idPrefix: string;
  autoGenerateId: boolean;
  isExistingFaculty: boolean;
  nextEmployeeId?: string;
  isFetchingNextEmployeeId?: boolean;
  onDraftChange: (patch: { employeeId: string }) => void;
  onRegenerateEmployeeId?: () => void;
  t: TranslationFunction;
}

export function FacultyEmploymentEmployeeIdField({
  label,
  required,
  error,
  employeeId,
  idPrefix,
  autoGenerateId,
  isExistingFaculty,
  nextEmployeeId,
  isFetchingNextEmployeeId,
  onDraftChange,
  onRegenerateEmployeeId,
  t,
}: FacultyEmploymentEmployeeIdFieldProps): React.JSX.Element {
  const previewId = extractEmployeeId(nextEmployeeId);
  const lockGenerated = autoGenerateId && !isExistingFaculty;
  return (
    <Field
      label={label}
      id="employeeId"
      required={required}
      error={error}
      hint={
        isExistingFaculty
          ? undefined
          : t(
              autoGenerateId
                ? "faculty.form.employeeIdSetupHint"
                : "faculty.form.employeeIdManualHint",
            )
      }
    >
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <LeadingIconInput
            id="employeeId"
            name="employeeId"
            icon={Hash}
            value={extractEmployeeId(employeeId)}
            onChange={(event) => onDraftChange({ employeeId: event.target.value })}
            placeholder={previewId || t("faculty.form.employeeIdPlaceholder", { prefix: idPrefix })}
            disabled={lockGenerated}
            className={error ? FORM_INPUT_ERROR : undefined}
          />
        </div>
        {lockGenerated && onRegenerateEmployeeId && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-11 min-w-11 shrink-0 border-border/70 hover:bg-muted"
            onClick={onRegenerateEmployeeId}
            disabled={isFetchingNextEmployeeId}
            title={t("faculty.form.regenerateId")}
            aria-label={t("faculty.form.regenerateId")}
          >
            <RotateCw
              className={cn(
                "h-4 w-4 text-muted-foreground",
                isFetchingNextEmployeeId && "animate-spin text-primary",
              )}
            />
          </Button>
        )}
      </div>
    </Field>
  );
}
