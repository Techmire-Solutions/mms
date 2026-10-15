import { Button } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";

export function WorkspaceAdminDialogFooter({
  complete,
  pending,
  confirmLabel,
  onClose,
  onConfirm,
  form,
}: {
  complete: boolean;
  pending: boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm?: () => Promise<void> | void;
  form?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  if (complete)
    return (
      <Button variant="primary" onClick={onClose}>
        {t("common.close")}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5 w-full">
      <Button variant="outline" onClick={onClose} disabled={pending}>
        {t("common.cancel")}
      </Button>
      <Button
        type={form ? "submit" : "button"}
        form={form}
        variant="primary"
        onClick={onConfirm}
        loading={pending}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
