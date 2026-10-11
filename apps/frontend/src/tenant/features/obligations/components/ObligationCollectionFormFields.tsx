import React from "react";
import { Receipt, Coins, DollarSign, Users } from "lucide-react";
import {
  PAYMENT_MODES,
  type ObligationType,
  type MujtahidRep,
  type Mujtahid,
} from "@/lib/data/obligationsData";
import { DEFAULT_CURRENCIES, type AppTranslationKey } from "@mms/shared";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { useTranslation } from "@/hooks/useTranslation";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { Field } from "@/components/ui/FormPrimitives";
import { Card } from "@/components/ui/card";
import { SectionCard } from "@/components/ui/SectionCard";
import { ObligationCollectionWakalaSection } from "@/tenant/features/obligations/components/ObligationCollectionWakalaSection";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/semanticTone";

export type ObligationCollectionFormState = {
  receipt_no: string;
  received_date: string;
  sender_id: string;
  reference_id: string;
  amount: string;
  currency_id: string;
  payment_mode: string;
  obligation_type_id: string;
  mujtahid_representative_id: string;
  received_by: string;
};

export interface ObligationCollectionFormFieldsProps {
  form: ObligationCollectionFormState;
  setForm: React.Dispatch<React.SetStateAction<ObligationCollectionFormState>>;
  errors: Partial<Record<keyof ObligationCollectionFormState, AppTranslationKey>>;
  obligationTypes: ObligationType[];
  eligibleReps: MujtahidRep[];
  getMujtahid: (repId: string) => Mujtahid | null | undefined;
  selectedMujtahid: Mujtahid | null | undefined;
  canAddType?: boolean;
  canAddRep?: boolean;
  onOpenAddType?: () => void;
  onOpenAddRep?: () => void;
  currencies?: Array<{ id: string; code: string; name: string; symbol: string }>;
}

export function ObligationCollectionFormFields({
  form,
  setForm,
  errors,
  obligationTypes,
  eligibleReps,
  getMujtahid,
  selectedMujtahid,
  canAddType = false,
  canAddRep = false,
  onOpenAddType,
  onOpenAddRep,
  currencies = DEFAULT_CURRENCIES,
}: ObligationCollectionFormFieldsProps): React.JSX.Element {
  const { t } = useTranslation();

  const formField = (
    key: keyof ObligationCollectionFormState,
    label: string,
    required: boolean,
    children: React.ReactNode,
  ) => (
    <Field
      id={`obligation-${key}`}
      label={label}
      required={required}
      error={errors[key] ? t(errors[key]!) : undefined}
    >
      {children}
    </Field>
  );

  return (
    <div className="space-y-3">
      <Card
        accentColor="primary"
        className={cn(
          "p-4 flex items-center gap-3.5 bg-primary/5 border-primary/25",
          CARD_STRIPE_INSET,
        )}
      >
        <Receipt className="w-5 h-5 text-primary" aria-hidden="true" />
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide m-0">
            {t("obligations.form.receiptAuto")}
          </h3>
          <p className="text-lg font-bold text-primary font-mono m-0">{form.receipt_no}</p>
        </div>
      </Card>

      <SectionCard
        accentColor="primary"
        icon={Receipt}
        title={t("obligations.form.section.metadata")}
        className="p-0 text-start"
      >
        <fieldset className="space-y-4 border-0 m-0 p-0 text-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formField(
              "received_date",
              t("obligations.form.receivedDate"),
              true,
              <DatePicker
                id="received_date"
                name="received_date"
                value={form.received_date}
                onChange={(val) => setForm({ ...form, received_date: val })}
                required
              />,
            )}
            {formField(
              "payment_mode",
              t("obligations.form.paymentMode"),
              true,
              <FormSelect
                id="obligation-payment_mode"
                name="payment_mode"
                value={form.payment_mode}
                onChange={(val) => setForm({ ...form, payment_mode: val })}
                options={PAYMENT_MODES.map((mode) => ({
                  value: mode,
                  label:
                    mode === "Cash"
                      ? t("obligations.paymentMode.cash")
                      : t("obligations.paymentMode.online"),
                }))}
                className="w-full"
              />,
            )}
          </div>
        </fieldset>
      </SectionCard>

      <SectionCard
        accentColor="primary"
        icon={Users}
        title={t("obligations.form.section.sender")}
        className="p-0 text-start z-sticky"
      >
        <fieldset className="space-y-4 border-0 m-0 p-0 text-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formField(
              "sender_id",
              t("obligations.form.sender"),
              true,
              <ContactPicker
                label={t("obligations.form.sender")}
                value={form.sender_id || null}
                onChange={(contactId) =>
                  setForm({ ...form, sender_id: contactId != null ? String(contactId) : "" })
                }
                searchPlaceholder={t("contacts.picker.searchPlaceholder")}
              />,
            )}
            {formField(
              "reference_id",
              t("obligations.form.reference"),
              false,
              <ContactPicker
                label={t("obligations.form.reference")}
                value={form.reference_id || null}
                onChange={(contactId) =>
                  setForm({ ...form, reference_id: contactId != null ? String(contactId) : "" })
                }
                allowCreate={false}
                searchPlaceholder={t("contacts.picker.searchPlaceholder")}
              />,
            )}
          </div>
        </fieldset>
      </SectionCard>

      <SectionCard
        accentColor="primary"
        icon={Coins}
        title={t("obligations.form.section.financial")}
        className="p-0 text-start z-elevated"
      >
        <fieldset className="space-y-4 border-0 m-0 p-0 text-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {formField(
              "amount",
              t("obligations.form.amount"),
              true,
              <div className="relative flex items-center group/input w-full">
                <DollarSign className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none z-elevated" />
                <Input
                  id="obligation-amount"
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  placeholder="0.00"
                  className="ps-10 w-full"
                />
              </div>,
            )}
            {formField(
              "currency_id",
              t("obligations.form.currency"),
              true,
              <FormSelect
                id="obligation-currency_id"
                name="currency_id"
                value={form.currency_id}
                onChange={(val) => setForm({ ...form, currency_id: val })}
                options={currencies.map((currency) => ({
                  value: currency.id,
                  label: `${currency.code} – ${currency.name}`,
                }))}
                className="w-full"
              />,
            )}
          </div>
        </fieldset>
      </SectionCard>

      <ObligationCollectionWakalaSection
        form={form}
        setForm={setForm}
        errors={errors}
        obligationTypes={obligationTypes}
        eligibleReps={eligibleReps}
        getMujtahid={getMujtahid}
        selectedMujtahid={selectedMujtahid}
        canAddType={canAddType}
        canAddRep={canAddRep}
        onOpenAddType={onOpenAddType}
        onOpenAddRep={onOpenAddRep}
        formField={formField}
      />
    </div>
  );
}
