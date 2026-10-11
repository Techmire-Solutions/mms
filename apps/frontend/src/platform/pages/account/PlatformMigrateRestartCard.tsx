import React, { useState } from "react";
import { ServerCog } from "lucide-react";
import { MIGRATE_AND_RESTART_CONFIRM } from "@mms/shared";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import {
  useMigrateAndRestartPlatform,
  waitForBackendReadyAfterMigrate,
} from "@/platform/hooks/usePlatformSettings";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { notify } from "@/lib/notify";
import { TypedConfirmDialog } from "@/components/ui/TypedConfirmDialog";

export function PlatformMigrateRestartCard(): React.JSX.Element | null {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const migrateMutation = useMigrateAndRestartPlatform();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [waitingForReady, setWaitingForReady] = useState(false);

  const isBusy = migrateMutation.isPending || waitingForReady;

  if (!isSuperUser) return null;

  const handleMigrateAndRestart = async (): Promise<void> => {
    if (confirmText.trim() !== MIGRATE_AND_RESTART_CONFIRM || !password.trim()) return;
    setFormError(null);
    try {
      const result = await migrateMutation.mutateAsync({
        confirm: confirmText.trim(),
        password,
      });
      setDialogOpen(false);
      setConfirmText("");
      setPassword("");
      setWaitingForReady(true);
      notify.info(t("platform.profileMigrateRestartWaiting"));
      await waitForBackendReadyAfterMigrate(result.delayMs);
      window.location.reload();
    } catch (err) {
      setFormError(getPlatformErrorMessage(err, t));
      setWaitingForReady(false);
    }
  };

  return (
    <>
      <SectionCard
        title={t("platform.profileMigrateRestart")}
        subtitle={t("platform.profileMigrateRestartDesc")}
        icon={ServerCog}
        accentColor="indigo"
        className="text-start"
      >
        <Button
          type="button"
          variant="outline"
          className="w-full font-bold"
          loading={waitingForReady}
          disabled={isBusy}
          onClick={() => {
            setFormError(null);
            setConfirmText("");
            setPassword("");
            setDialogOpen(true);
          }}
        >
          {waitingForReady
            ? t("platform.profileMigrateRestartWaiting")
            : t("platform.profileMigrateRestartButton")}
        </Button>
      </SectionCard>

      <TypedConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t("platform.profileMigrateRestartTitle")}
        description={t("platform.profileMigrateRestartDesc")}
        confirmLabel={t("platform.profileMigrateRestartPrompt", {
          confirm: MIGRATE_AND_RESTART_CONFIRM,
        })}
        expectedConfirm={MIGRATE_AND_RESTART_CONFIRM}
        confirmValue={confirmText}
        onConfirmValueChange={(value) => {
          setConfirmText(value);
          if (formError) setFormError(null);
        }}
        confirmInputName="confirmMigrateRestartText"
        confirmPlaceholder={MIGRATE_AND_RESTART_CONFIRM}
        password={password}
        onPasswordChange={(value) => {
          setPassword(value);
          if (formError) setFormError(null);
        }}
        passwordInputId="migrate-restart-password"
        passwordInputName="migrateRestartPassword"
        error={formError}
        pending={isBusy}
        confirmButtonLabel={t("platform.profileMigrateRestartConfirm")}
        confirmVariant="default"
        destructiveTitle={false}
        onConfirm={() => void handleMigrateAndRestart()}
      />
    </>
  );
}
