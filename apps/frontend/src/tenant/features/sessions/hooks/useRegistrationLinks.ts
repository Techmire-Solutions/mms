import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegistrationLink, RegistrationLinkWrite } from '@mms/shared';
import { useAuth } from '@/lib/contexts/AuthContext';
import { isApiError } from '@/lib/apiError';
import { notify } from '@/lib/notify';
import { useTranslation } from '@/hooks/useTranslation';
import { ROUTES } from '@/lib/config/routes';
import {
  deleteRegistrationLinkMutationOptions,
  invalidateRegistrationQueries,
  registrationLinksQueryOptions,
  saveRegistrationLinkMutationOptions,
} from '@/lib/query/registrationQueries';

/** Shareable public URL of a link on this tenant's subdomain. */
export function registrationLinkUrl(link: Pick<RegistrationLink, 'slug'>): string {
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
  const onSettled = () => invalidateRegistrationQueries(queryClient);
  const saveMutation = useMutation({ ...saveRegistrationLinkMutationOptions(sessionId), onSettled });
  const deleteMutation = useMutation({ ...deleteRegistrationLinkMutationOptions(sessionId), onSettled });

  const save = async (id: string | undefined, body: RegistrationLinkWrite): Promise<RegistrationLink | null> => {
    try {
      const saved = await saveMutation.mutateAsync({ id: id ?? crypto.randomUUID(), body });
      notify.success(t('sessions.registration.saved'));
      return saved;
    } catch (error) {
      notify.error(t('sessions.registration.saveFailed'), { description: isApiError(error) ? error.message : undefined });
      return null;
    }
  };

  const remove = async (link: RegistrationLink): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(link.id);
      notify.info(t('sessions.registration.deleted'));
      return true;
    } catch (error) {
      notify.error(t('sessions.registration.deleteFailed'), { description: isApiError(error) ? error.message : undefined });
      return false;
    }
  };

  const copy = async (link: RegistrationLink): Promise<void> => {
    try {
      await navigator.clipboard.writeText(registrationLinkUrl(link));
      notify.success(t('sessions.registration.copied'));
    } catch {
      notify.error(t('sessions.registration.copyFailed'));
    }
  };

  return { save, remove, copy, isPending: saveMutation.isPending || deleteMutation.isPending };
}
