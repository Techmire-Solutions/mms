import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RegistrationLink, RegistrationLinkWrite } from "@mms/contracts";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { isApiError } from "@mms/fe-core/api/errors";
import { notify } from "@mms/fe-core/notify";
import { useTranslation } from "@mms/fe-core/i18n";
import { ROUTES } from "@mms/fe-core/config/routes";
import {
  deleteRegistrationLinkMutationOptions,
  invalidateRegistrationQueries,
  registrationLinksQueryOptions,
  saveRegistrationLinkMutationOptions,
} from "../hooks/registrationQueries.js";

/** Shareable public URL of a link on this tenant's subdomain. */
export function registrationLinkUrl(link: Pick<RegistrationLink, "slug">): string {
  return `${window.location.origin}${ROUTES.apply}/${link.slug}`;
}

export function useRegistrationLinks(sessionId: string) {
  const { isAuthenticated } = useAuth();
  return useQuery(registrationLinksQueryOptions(sessionId, isAuthenticated));
}

/** Save / delete / copy with call-site toasts. */
export function useRegistrationLinkActions(sessionId: string) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);
  const onSettled = () => invalidateRegistrationQueries(queryClient);
  const saveMutation = useMutation({
    ...saveRegistrationLinkMutationOptions(sessionId),
    onSettled,
  });
  const deleteMutation = useMutation({
    ...deleteRegistrationLinkMutationOptions(sessionId),
    onSettled,
  });

  const save = async (
    id: string | undefined,
    body: RegistrationLinkWrite,
  ): Promise<RegistrationLink | null> => {
    setSaveError(null);
    try {
      const saved = await saveMutation.mutateAsync({ id: id ?? crypto.randomUUID(), body });
      notify.success(t("sessions.registration.saved"));
      return saved;
    } catch (error) {
      const description = isApiError(error) ? error.message : undefined;
      setSaveError(description ?? t("sessions.registration.saveFailed"));
      notify.error(t("sessions.registration.saveFailed"), { description });
      return null;
    }
  };

  const remove = async (link: RegistrationLink): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(link.id);
      notify.info(t("sessions.registration.deleted"));
      return true;
    } catch (error) {
      notify.error(t("sessions.registration.deleteFailed"), {
        description: isApiError(error) ? error.message : undefined,
      });
      return false;
    }
  };

  const copy = async (link: RegistrationLink): Promise<void> => {
    try {
      await navigator.clipboard.writeText(registrationLinkUrl(link));
      notify.success(t("sessions.registration.copied"));
    } catch {
      notify.error(t("sessions.registration.copyFailed"));
    }
  };

  return {
    save,
    remove,
    copy,
    saveError,
    isPending: saveMutation.isPending || deleteMutation.isPending,
  };
}
