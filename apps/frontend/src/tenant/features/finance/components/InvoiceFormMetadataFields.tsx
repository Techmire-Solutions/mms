import React from "react";
import { School, Calendar, DollarSign, Tag } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { FORM_INPUT, FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { FormSelect } from "@/components/ui/FormSelect";
import { Field } from "@/components/ui/FormPrimitives";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { InvoiceDraft } from "@/tenant/features/finance/components/invoiceFormDraft";

export interface InvoiceFormMetadataFieldsProps {
  draft: InvoiceDraft;
  onFieldChange: (key: keyof InvoiceDraft, value: string) => void;
  errors?: Record<string, string>;
  t: TranslationFunction;
}

export function InvoiceFormMetadataFields({
  draft,
  onFieldChange,
  errors = {},
  t,
}: InvoiceFormMetadataFieldsProps): React.JSX.Element {
  return (
    <>
      <Field id="invoice-class" label={t("finance.form.class")} required error={errors.class}>
        <div className="relative flex items-center group/input">
          <School className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
          <Input
            id="invoice-class"
            name="class"
            className={cn(`${FORM_INPUT} ps-10`, errors.class && FORM_INPUT_ERROR)}
            value={draft.class}
            onChange={(event) => onFieldChange("class", event.target.value)}
            required
          />
        </div>
      </Field>

      <Field id="invoice-session" label={t("finance.form.session")} required error={errors.session}>
        <div className="relative flex items-center group/input">
          <Calendar className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
          <Input
            id="invoice-session"
            name="session"
            className={cn(`${FORM_INPUT} ps-10`, errors.session && FORM_INPUT_ERROR)}
            value={draft.session}
            onChange={(event) => onFieldChange("session", event.target.value)}
            required
          />
        </div>
      </Field>

      <Field
        id="invoice-base-fee"
        label={t("finance.columns.baseFee")}
        required
        error={errors.baseFee}
      >
        <div className="relative flex items-center group/input">
          <DollarSign className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
          <Input
            id="invoice-base-fee"
            name="baseFee"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className={cn(`${FORM_INPUT} ps-10`, errors.baseFee && FORM_INPUT_ERROR)}
            value={draft.baseFee}
            onChange={(event) => onFieldChange("baseFee", event.target.value)}
            required
          />
        </div>
      </Field>

      <Field
        id="invoice-due-date"
        label={t("finance.columns.dueDate")}
        required
        error={errors.dueDate}
      >
        <DatePicker
          id="invoice-due-date"
          name="dueDate"
          value={draft.dueDate}
          onChange={(value) => onFieldChange("dueDate", value)}
          required
        />
      </Field>

      <Field id="invoice-discount-type" label={t("finance.form.discountType")}>
        <FormSelect
          id="invoice-discount-type"
          name="discountType"
          value={draft.discountType}
          onChange={(value) => onFieldChange("discountType", value)}
          options={[
            { value: "", label: t("common.none") },
            { value: "manual", label: t("finance.discount.manual") },
            { value: "sibling", label: t("finance.discount.sibling") },
            { value: "scholarship", label: t("finance.discount.scholarship") },
            { value: "staff", label: t("finance.discount.staff") },
          ]}
        />
      </Field>

      <Field
        id="invoice-discount-value"
        label={t("finance.form.discountAmount")}
        error={errors.discountValue}
      >
        <div className="relative flex items-center group/input">
          <Tag className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
          <Input
            id="invoice-discount-value"
            name="discountValue"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            className={cn(`${FORM_INPUT} ps-10`, errors.discountValue && FORM_INPUT_ERROR)}
            value={draft.discountValue}
            onChange={(event) => onFieldChange("discountValue", event.target.value)}
          />
        </div>
      </Field>
    </>
  );
}
