import React from "react";
import { ReceiptText, User, Hash } from "lucide-react";
import { FORM_INPUT, FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/app/SectionCard";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { FeeStructure } from "@mms/shared";
import type { InvoiceDraft } from "@/tenant/features/finance/lib/invoiceFormDraft";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { InvoiceFormMetadataFields } from "@/tenant/features/finance/components/InvoiceFormMetadataFields";

export interface InvoiceFormFieldsSectionProps {
  t: TranslationFunction;
  draft: InvoiceDraft;
  onFieldChange: (key: keyof InvoiceDraft, value: string) => void;
  feeStructures?: FeeStructure[];
  onApplyFeeStructure?: (structureId: string) => void;
  errors?: Record<string, string>;
}

export const InvoiceFormFieldsSection = function InvoiceFormFieldsSection({
  t,
  draft,
  onFieldChange,
  feeStructures = [],
  onApplyFeeStructure,
  errors = {},
}: InvoiceFormFieldsSectionProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <SectionCard
        accentColor="primary"
        icon={ReceiptText}
        title={t("finance.form.information")}
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {feeStructures.length > 0 && (
            <div className="sm:col-span-2">
              <Field id="invoice-fee-structure" label={t("finance.form.feeStructure")}>
                <FormSelect
                  id="invoice-fee-structure"
                  name="feeStructureId"
                  value={draft.feeStructureId}
                  onChange={(value) => onApplyFeeStructure?.(value)}
                  options={[
                    { value: "", label: t("common.none") },
                    ...feeStructures.map((structure) => ({
                      value: structure.id,
                      label: structure.name,
                    })),
                  ]}
                />
              </Field>
            </div>
          )}

          <div className="space-y-1.5">
            <RegistryPersonSelect
              kind="student"
              id="invoice-student-id-select"
              name="studentId"
              label={t("finance.form.studentId")}
              searchLabel={t("finance.form.studentId")}
              searchPlaceholder={t("registryPerson.searchPlaceholder")}
              value={draft.studentId}
              onPick={(id, name) => {
                onFieldChange("studentId", id);
                if (name) onFieldChange("studentName", name);
              }}
              onChange={(id, name) => {
                onFieldChange("studentId", id);
                if (name) onFieldChange("studentName", name);
              }}
            />
          </div>

          <Field
            id="invoice-student-name"
            label={t("finance.form.studentName")}
            required
            error={errors.studentName}
          >
            <div className="relative flex items-center group/input">
              <User className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="invoice-student-name"
                name="studentName"
                className={cn(`${FORM_INPUT} ps-10`, errors.studentName && FORM_INPUT_ERROR)}
                value={draft.studentName}
                onChange={(event) => onFieldChange("studentName", event.target.value)}
                required
              />
            </div>
          </Field>

          <Field
            id="invoice-student-id"
            label={t("finance.form.studentId")}
            required
            error={errors.studentId}
          >
            <div className="relative flex items-center group/input">
              <Hash className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="invoice-student-id"
                name="studentId"
                className={cn(`${FORM_INPUT} ps-10`, errors.studentId && FORM_INPUT_ERROR)}
                value={draft.studentId}
                onChange={(event) => onFieldChange("studentId", event.target.value)}
                required
              />
            </div>
          </Field>

          <InvoiceFormMetadataFields
            draft={draft}
            onFieldChange={onFieldChange}
            errors={errors}
            t={t}
          />
        </div>
      </SectionCard>
    </div>
  );
};
