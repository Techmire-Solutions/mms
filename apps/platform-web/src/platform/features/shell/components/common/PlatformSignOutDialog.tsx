import { ConfirmAlertDialog } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";

interface PlatformSignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function PlatformSignOutDialog(props: PlatformSignOutDialogProps) {
  const { t } = useTranslation();
  return (
    <ConfirmAlertDialog
      {...props}
      title={t("platform.signOut")}
      description={t("platform.signOutConfirm")}
      confirmLabel={t("platform.signOut")}
      destructive
    />
  );
}
