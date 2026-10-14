import React, { type Dispatch, type SetStateAction } from "react";
import { User, Users2 } from "lucide-react";
import { RegistryPersonSelect } from "@/tenant/components/selectors/RegistryPersonSelect";
import { Field, FieldErrorMessage, RequiredMark } from "@/components/app/FormPrimitives";
import { FORM_INPUT, FORM_LABEL } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import type { Distribution } from "@/lib/data/hasanatData";

export interface DistributeRecipientTypeFieldProps {
  data: Partial<Distribution>;
  setData: Dispatch<SetStateAction<Partial<Distribution>>>;
}

export function DistributeRecipientTypeField({
  data,
  setData,
}: DistributeRecipientTypeFieldProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="sm:col-span-2">
      <span id="recipient-type-label" className={FORM_LABEL}>
        {t("hasanat.form.recipientType")}
        <RequiredMark />
      </span>
      <div role="radiogroup" aria-labelledby="recipient-type-label" className="flex gap-2">
        {[
          {
            id: "student" as const,
            label: t("hasanat.form.recipientType.student"),
            icon: User,
          },
          {
            id: "faculty" as const,
            label: t("hasanat.form.recipientType.faculty"),
            icon: Users2,
          },
        ].map((recipientTypeOption) => {
          const Icon = recipientTypeOption.icon;
          const isSelected = data.recipientType === recipientTypeOption.id;
          return (
            <Button
              key={recipientTypeOption.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() =>
                setData((previousData) => ({
                  ...previousData,
                  recipientType: recipientTypeOption.id,
                  recipientStudentId:
                    recipientTypeOption.id === "student"
                      ? previousData.recipientStudentId
                      : undefined,
                  recipientFacultyId:
                    recipientTypeOption.id === "faculty"
                      ? previousData.recipientFacultyId
                      : undefined,
                }))
              }
              className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {recipientTypeOption.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export interface DistributeRecipientSelectFieldProps {
  data: Partial<Distribution>;
  setData: Dispatch<SetStateAction<Partial<Distribution>>>;
  updateField: (field: string, value: unknown) => void;
  errors?: Record<string, string>;
}

export function DistributeRecipientSelectField({
  data,
  setData,
  updateField,
  errors,
}: DistributeRecipientSelectFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const recipientId =
    data.recipientType === "faculty"
      ? data.recipientFacultyId || ""
      : data.recipientStudentId || "";

  return (
    <div>
      <RegistryPersonSelect
        id="hasanat-recipient"
        kind={data.recipientType === "faculty" ? "faculty" : "student"}
        label={t("hasanat.fieldRecipient")}
        required
        value={recipientId}
        onChange={(id) => {
          if (data.recipientType === "faculty") {
            updateField("recipientFacultyId", id);
            setData((previousData) => ({
              ...previousData,
              recipientFacultyId: id,
              recipientStudentId: undefined,
            }));
          } else {
            updateField("recipientStudentId", id);
            setData((previousData) => ({
              ...previousData,
              recipientStudentId: id,
              recipientFacultyId: undefined,
            }));
          }
        }}
      />
      <FieldErrorMessage id="recipient-error" message={errors?.recipientName} />
    </div>
  );
}

export interface DistributeRecipientClassFieldProps {
  data: Partial<Distribution>;
  updateField: (field: string, value: unknown) => void;
  isRequired?: boolean;
  errors?: Record<string, string>;
}

export function DistributeRecipientClassField({
  data,
  updateField,
  isRequired = false,
  errors,
}: DistributeRecipientClassFieldProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Field
      id="recp-class"
      label={
        data.recipientType === "student"
          ? t("hasanat.form.classLabel")
          : t("hasanat.form.departmentLabel")
      }
      required={isRequired}
      error={errors?.recipientClass}
    >
      <Input
        id="recp-class"
        name="recipientClass"
        className={FORM_INPUT}
        value={data.recipientClass || ""}
        onChange={(event) => updateField("recipientClass", event.target.value)}
        placeholder={t("hasanat.form.recipientClassPlaceholder")}
      />
    </Field>
  );
}
