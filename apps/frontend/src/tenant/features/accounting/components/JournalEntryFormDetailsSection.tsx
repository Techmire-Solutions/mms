import React from "react";
import { BookOpen } from "lucide-react";
import { type FiscalYear } from "@/lib/data/accountingData";
import { SectionCard } from "@/components/ui/SectionCard";
import { Field } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormSelect } from "@/components/ui/FormSelect";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DraftForm } from "./journalEntryFormTypes";
import { NextVoucherNumberHint } from "./NextVoucherNumberHint";

interface JournalEntryFormDetailsSectionProps {
  t: TranslationFunction;
  form: DraftForm;
  setForm: React.Dispatch<React.SetStateAction<DraftForm>>;
  errors: Record<string, string>;
  fiscalYears: FiscalYear[];
}

export function JournalEntryFormDetailsSection({
  t,
  form,
  setForm,
  errors,
  fiscalYears,
}: JournalEntryFormDetailsSectionProps): React.JSX.Element {
  return (
    <SectionCard
      accentColor="primary"
      icon={BookOpen}
      title={t("accounting.journal.form.entryDetails")}
      className="shadow-sm text-start"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field
          id="je-date"
          label={t("accounting.journal.form.dateLabel")}
          required
          error={errors.date}
          errorId="je-date-error"
        >
          <DatePicker
            id="je-date"
            name="date"
            value={form.date}
            onChange={(dateValue) => setForm({ ...form, date: dateValue })}
            required
          />
        </Field>

        <Field id="journal-entry-financial-year" label={t("accounting.journal.form.financialYear")}>
          <FormSelect
            id="journal-entry-financial-year"
            name="fiscalYear"
            value={form.fiscal_year_id || form.fiscal_year || ""}
            onChange={(fiscalYearValue) => {
              const selected = (fiscalYears || []).find(
                (fiscalYear) =>
                  fiscalYear.id === fiscalYearValue || fiscalYear.label === fiscalYearValue,
              );
              setForm({
                ...form,
                fiscal_year_id: selected?.id,
                fiscal_year: selected?.label ?? fiscalYearValue,
              });
            }}
            placeholder={t("accounting.journal.form.none")}
            options={(fiscalYears || []).map((fiscalYear) => ({
              value: fiscalYear.id,
              label: fiscalYear.label,
            }))}
          />
        </Field>

        <Field
          id="journal-entry-ref"
          label={
            <>
              {t("accounting.journal.dashboard.wizard.refNo")}{" "}
              <span className="normal-case font-normal text-foreground">
                {t("accounting.journal.dashboard.wizard.optional")}
              </span>
            </>
          }
          error={errors.ref}
          errorId="je-ref-error"
        >
          <Input
            id="journal-entry-ref"
            name="ref"
            value={form.ref || ""}
            onChange={(event) => setForm({ ...form, ref: event.target.value })}
            placeholder={t("accounting.journal.dashboard.wizard.refPlaceholder")}
          />
          {!form.ref?.trim() && <NextVoucherNumberHint id="je-ref-next" date={form.date} />}
        </Field>

        <div className="sm:col-span-3">
          <Field
            id="journal-entry-description"
            label={t("accounting.journal.form.narrationLabel")}
            error={errors.description}
            errorId="je-description-error"
          >
            <div className="relative flex items-center group/input">
              <BookOpen className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="journal-entry-description"
                name="description"
                className="ps-10"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder={t("accounting.journal.form.narrationPlaceholder")}
              />
            </div>
          </Field>
        </div>
      </div>
    </SectionCard>
  );
}
