import type React from "react";
import { Calendar, Wallet } from "lucide-react";
import { DatePicker } from "@/components/app/DatePicker";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { AcademicCatalogSelect } from "@/components/common/catalog/AcademicCatalogSelect";
import { SectionCard } from "@/components/app/SectionCard";
import { Alert } from "@/components/app/Alert";
import { FORM_INPUT, FORM_TEXTAREA } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { Session } from "@/lib/data/sessionsData";
import type { SessionFormDraft } from "@/tenant/features/sessions/lib/sessionFormShared";

export interface SessionSelectOption {
  value: string;
  label: string;
}

interface SessionSectionBaseProps {
  sessionDraft: SessionFormDraft;
  errors: Record<string, string>;
  onDraftChange: (patch: Partial<SessionFormDraft>) => void;
}

interface SessionDetailsSectionProps extends SessionSectionBaseProps {
  statusOptions: SessionSelectOption[];
  /** Show inline quick-create on catalog pickers (Sessions setup permission). */
  canCreateCatalog: boolean;
  /** Pre-selected "Academic Year" category for new sessions. */
  defaultCategoryId: string;
  /** Session has started: start date, category and program are locked. */
  structureLocked?: boolean;
}

export function SessionDetailsSection({
  canCreateCatalog,
  defaultCategoryId,
  structureLocked = false,
  errors,
  sessionDraft,
  statusOptions,
  onDraftChange,
}: SessionDetailsSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <SectionCard
        accentColor="primary"
        icon={Calendar}
        title={t("sessions.form.sectionDetails")}
        className="shadow-sm text-start"
      >
        {structureLocked ? (
          <Alert
            density="banner"
            title={t("sessions.lock.title")}
            description={t("sessions.lock.hint")}
          />
        ) : null}
        <Field label={t("sessions.form.name")} id="session-name" required error={errors.name}>
          <div className="relative flex items-center group/input">
            <Calendar className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
            <Input
              id="session-name"
              name="name"
              value={sessionDraft.name || ""}
              onChange={(event) => onDraftChange({ name: event.target.value })}
              placeholder={t("sessions.form.namePlaceholder")}
              className={cn(FORM_INPUT, "ps-10")}
            />
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("sessions.form.category")} id="session-category">
            <AcademicCatalogSelect
              kind="categories"
              id="session-category"
              name="categoryId"
              value={sessionDraft.categoryId || defaultCategoryId}
              onChange={(id) => onDraftChange({ categoryId: id })}
              canCreate={canCreateCatalog}
              disabled={structureLocked}
            />
          </Field>

          <Field label={t("sessions.form.program")} id="session-program">
            <AcademicCatalogSelect
              kind="programs"
              id="session-program"
              name="programId"
              value={sessionDraft.programId || ""}
              onChange={(id) => onDraftChange({ programId: id })}
              canCreate={canCreateCatalog}
              disabled={structureLocked}
              allowNone
            />
          </Field>

          <Field label={t("sessions.form.status")} id="session-status">
            <FormSelect
              id="session-status"
              name="status"
              value={sessionDraft.status || "active"}
              onChange={(val) => onDraftChange({ status: val as Session["status"] })}
              options={statusOptions}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={t("sessions.form.startDate")}
            required
            error={errors.startDate}
            id="session-start-date"
          >
            <DatePicker
              id="session-start-date"
              name="startDate"
              value={sessionDraft.startDate || undefined}
              onChange={(dateStr) => onDraftChange({ startDate: dateStr })}
              max={sessionDraft.endDate || undefined}
              disabled={structureLocked}
              required
            />
          </Field>

          <Field
            label={t("sessions.form.endDate")}
            required
            error={errors.endDate}
            id="session-end-date"
          >
            <DatePicker
              id="session-end-date"
              name="endDate"
              value={sessionDraft.endDate || undefined}
              onChange={(dateStr) => onDraftChange({ endDate: dateStr })}
              min={sessionDraft.startDate || undefined}
              required
            />
          </Field>
        </div>

        <Field label={t("sessions.form.description")} id="session-description">
          <Textarea
            id="session-description"
            name="description"
            value={sessionDraft.description || ""}
            onChange={(event) => onDraftChange({ description: event.target.value })}
            placeholder={t("sessions.form.descriptionPlaceholder")}
            className={cn(FORM_TEXTAREA, "min-h-textarea-lg")}
          />
        </Field>
      </SectionCard>
    </div>
  );
}

interface SessionFinancialSectionProps extends SessionSectionBaseProps {
  currencyOptions: string[];
  defaultCurrency: string;
}

export function SessionFinancialSection({
  currencyOptions,
  defaultCurrency,
  errors,
  sessionDraft,
  onDraftChange,
}: SessionFinancialSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 text-start">
      <SectionCard
        accentColor="primary"
        icon={Wallet}
        title={t("sessions.form.sectionFinancial")}
        className="shadow-sm text-start"
      >
        <Field label={t("sessions.form.baseFee")} id="session-baseFee" error={errors.baseFee}>
          <div className="relative flex items-center group/input">
            <Wallet className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
            <Input
              id="session-baseFee"
              name="baseFee"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={sessionDraft.baseFee || ""}
              onChange={(event) => onDraftChange({ baseFee: event.target.value })}
              className={cn(FORM_INPUT, "ps-10")}
            />
          </div>
        </Field>

        <Field label={t("sessions.form.currency")} id="session-currency">
          <FormSelect
            id="session-currency"
            name="currency"
            value={sessionDraft.currency || defaultCurrency}
            onChange={(val) => onDraftChange({ currency: val })}
            options={currencyOptions}
          />
        </Field>
      </SectionCard>
    </div>
  );
}
