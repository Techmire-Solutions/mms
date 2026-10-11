import React from "react";
import { SequenceNumberingCard } from "@/components/ui/sequence-numbering";
import { Button } from "@/components/ui/button";
import { FieldErrorMessage } from "@/components/ui/FormPrimitives";
import { useTranslation } from "@/hooks/useTranslation";
import { useVoucherNumberingSettings } from "./useVoucherNumberingSettings";

export interface AccountingSettingsNumberingSectionProps {
  canEdit: boolean;
}

/** Journal voucher numbering — stored server-side, where numbers are issued on save. */
export function AccountingSettingsNumberingSection({
  canEdit,
}: AccountingSettingsNumberingSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const { cardConfig, handleCardChange, prefixValid, formatChanged, dirty, isSaving, handleSave } =
    useVoucherNumberingSettings();

  return (
    <div className="space-y-2">
      <SequenceNumberingCard
        title={t("accounting.settings.secVoucher")}
        entityLabel={t("accounting.settings.voucher.entityLabel")}
        config={cardConfig}
        onChange={canEdit ? handleCardChange : () => undefined}
        allowYearless={true}
        allowFiscalRollover={true}
        defaultPrefixPlaceholder="JE"
        autoGenerateLabel={t("accounting.settings.voucher.autoGenerate")}
        prefixLabel={t("accounting.settings.voucher.prefix")}
        prefixHint={t("accounting.settings.voucher.prefixHint")}
        restartLabel={t("accounting.settings.voucher.restartAnnually")}
        restartDesc={t("accounting.settings.voucher.restartAnnuallyDesc")}
      />
      <FieldErrorMessage
        id="accounting-voucher-prefix-error"
        message={prefixValid ? undefined : t("accounting.settings.voucher.prefixInvalid")}
      />
      <p className="m-0 text-xs text-muted-foreground">{t("accounting.settings.voucher.hint")}</p>
      {formatChanged && (
        <p className="m-0 text-xs text-muted-foreground" role="note">
          {t("accounting.settings.voucher.formatChangeNote")}
        </p>
      )}
      {canEdit && (
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            void handleSave();
          }}
          disabled={isSaving || !dirty || !prefixValid}
        >
          {t("common.save")}
        </Button>
      )}
    </div>
  );
}
