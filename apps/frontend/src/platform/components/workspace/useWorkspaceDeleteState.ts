import { useState } from "react";
import type { PlatformWorkspaceRow as PlatformWorkspaceRowData } from "@mms/shared";
import { useDeleteWorkspace } from "@/platform/hooks/usePlatformWorkspaces";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { useTranslation } from "@/hooks/useTranslation";

export function useWorkspaceDeleteState() {
  const { t } = useTranslation();
  const deleteWorkspace = useDeleteWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetWorkspace, setTargetWorkspace] = useState<PlatformWorkspaceRowData | null>(null);
  const [password, setPassword] = useState("");
  const [confirmSubdomain, setConfirmSubdomain] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Closing the confirm dialog discards the target and typed secrets — reset during render.
  const [prevConfirmOpen, setPrevConfirmOpen] = useState(confirmOpen);
  if (prevConfirmOpen !== confirmOpen) {
    setPrevConfirmOpen(confirmOpen);
    if (!confirmOpen) {
      setTargetWorkspace(null);
      setPassword("");
      setConfirmSubdomain("");
      setPasswordError(null);
    }
  }

  const handleOpenDelete = (workspace: PlatformWorkspaceRowData): void => {
    setTargetWorkspace(workspace);
    setConfirmOpen(true);
  };

  const handleDelete = (): void => {
    if (!targetWorkspace) return;
    if (confirmSubdomain.trim().toLowerCase() !== targetWorkspace.subdomain.toLowerCase()) {
      setPasswordError(t("platform.deleteWorkspaceConfirmSubdomainMismatch"));
      return;
    }
    if (!password.trim()) {
      setPasswordError(t("platform.deleteWorkspacePasswordHint"));
      return;
    }
    setPasswordError(null);
    deleteWorkspace
      .mutateAsync({
        subdomain: targetWorkspace.subdomain,
        password,
        confirmSubdomain: confirmSubdomain.trim(),
      })
      .then(() => setConfirmOpen(false))
      .catch((error: unknown) => {
        setPasswordError(getPlatformErrorMessage(error, t));
      });
  };

  return {
    confirmOpen,
    setConfirmOpen,
    targetWorkspace,
    password,
    setPassword,
    confirmSubdomain,
    setConfirmSubdomain,
    passwordError,
    deletePending: deleteWorkspace.isPending,
    handleOpenDelete,
    handleDelete,
  };
}
