import { type Dispatch, type SetStateAction } from "react";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { FORM_INPUT } from "@mms/ui";
import { Input } from "@mms/ui";
import { UserActorSelect } from "./UserActorSelect.js";
import { useHasanatConfig } from "../hooks/useHasanatConfig";
import { useTranslation } from "@mms/fe-core/i18n";
import { type Denomination, type Distribution } from "../lib/hasanatData";
import { DistributeDenominationField } from "./DistributeDenominationField.js";
import type { DistributionFieldUpdate } from "./DistributeRecipientFields.js";
import {
  DistributeRecipientClassField,
  DistributeRecipientSelectField,
  DistributeRecipientTypeField,
} from "./DistributeRecipientFields.js";

interface DistributeModalFieldsProps {
  denoms: Denomination[];
  data: Partial<Distribution>;
  selectedDenomination?: Denomination;
  totalAvailable: number;
  setData: Dispatch<SetStateAction<Partial<Distribution>>>;
  updateField: DistributionFieldUpdate;
  errors?: Record<string, string>;
  onDenomsChange?: (denoms: Denomination[]) => Promise<void> | void;
}

export function DistributeModalFields({
  denoms,
  data,
  selectedDenomination,
  totalAvailable,
  setData,
  updateField,
  errors,
  onDenomsChange,
}: DistributeModalFieldsProps) {
  const { t } = useTranslation();
  const { fields, orderedFields, isFieldEnabled } = useHasanatConfig();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {orderedFields.map((field) => {
        if (!isFieldEnabled(field.id)) return null;

        if (field.id === "denominationId") {
          return (
            <DistributeDenominationField
              key="denominationId"
              denoms={denoms}
              data={data}
              selectedDenomination={selectedDenomination}
              totalAvailable={totalAvailable}
              updateField={updateField}
              errors={errors}
              onDenomsChange={onDenomsChange}
            />
          );
        }

        if (field.id === "recipientType") {
          return <DistributeRecipientTypeField key="recipientType" data={data} setData={setData} />;
        }

        if (field.id === "recipientName") {
          return (
            <DistributeRecipientSelectField
              key="recipientName"
              data={data}
              updateField={updateField}
              errors={errors}
            />
          );
        }

        if (field.id === "recipientClass") {
          return (
            <DistributeRecipientClassField
              key="recipientClass"
              data={data}
              updateField={updateField}
              isRequired={!!fields[field.id]?.required}
              errors={errors}
            />
          );
        }

        if (field.id === "quantity") {
          return (
            <Field
              key="quantity"
              id="qty"
              label={t("hasanat.form.quantity")}
              required
              error={errors?.quantity}
            >
              <Input
                id="qty"
                name="quantity"
                type="text"
                inputMode="numeric"
                className={FORM_INPUT}
                value={data.quantity ?? ""}
                onChange={(event) => {
                  const sanitized = event.target.value.replace(/[^0-9]/g, "");
                  updateField(
                    "quantity",
                    sanitized === "" ? undefined : Math.min(Number(sanitized), totalAvailable),
                  );
                }}
              />
            </Field>
          );
        }

        if (field.id === "issuedDate") {
          return (
            <Field
              key="issuedDate"
              id="issue-date"
              label={t("hasanat.form.issuedDate")}
              required
              error={errors?.issuedDate}
            >
              <DatePicker
                id="issue-date"
                name="issuedDate"
                value={data.issuedDate || ""}
                onChange={(value) => updateField("issuedDate", value)}
              />
            </Field>
          );
        }

        if (field.id === "reason") {
          return (
            <div key="reason" className="sm:col-span-2">
              <Field id="reason" label={t("hasanat.form.reason")} required error={errors?.reason}>
                <Input
                  id="reason"
                  name="reason"
                  className={FORM_INPUT}
                  value={data.reason || ""}
                  onChange={(event) => updateField("reason", event.target.value)}
                  placeholder={t("hasanat.form.reasonPlaceholder")}
                />
              </Field>
            </div>
          );
        }

        if (field.id === "issuedBy") {
          const isRequired = !!fields[field.id]?.required;
          return (
            <div key="issuedBy" className="sm:col-span-2">
              <UserActorSelect
                id="issued-by"
                label={t("hasanat.fieldIssuedBy")}
                required={isRequired}
                value={data.issuedByUserId || ""}
                error={errors?.issuedBy}
                onChange={(id: string) => updateField("issuedByUserId", id)}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
