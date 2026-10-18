import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AcademicCatalogItem, AcademicCatalogKind, AcademicCatalogWrite } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiError";
import { notify } from "@/lib/notify";
import { useTranslation } from "@/hooks/useTranslation";
import {
  academicCatalogQueryOptions,
  deleteAcademicCatalogItemMutationOptions,
  examinationSubjectsQueryOptions,
  invalidateAcademicCatalogQueries,
  restoreAcademicCatalogItemMutationOptions,
  saveAcademicCatalogItemMutationOptions,
} from "@/lib/query/academicCatalogQueries";

/** Sessions-owned catalog rows (Setup managers, Sessions pickers). */
export function useAcademicCatalogItems(
  kind: AcademicCatalogKind,
  options: { includeDeleted?: boolean; enabled?: boolean } = {},
) {
  const { isAuthenticated } = useAuth();
  return useQuery(
    academicCatalogQueryOptions(kind, {
      enabled: isAuthenticated && (options.enabled ?? true),
      includeDeleted: options.includeDeleted,
    }),
  );
}

/** Active subjects via the Examinations module (no Sessions grant required). */
export function useExaminationSubjects(enabled = true) {
  const { isAuthenticated } = useAuth();
  return useQuery(examinationSubjectsQueryOptions(isAuthenticated && enabled));
}

function errorDetail(error: unknown): string | undefined {
  return isApiError(error) && error.status === 409 ? error.message : undefined;
}

/** Save / delete / restore with call-site toasts; each resolves to null/false on failure. */
export function useAcademicCatalogActions(kind: AcademicCatalogKind) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const item = t(`academicCatalog.kind.${kind}.singular`);
  const onSettled = () => invalidateAcademicCatalogQueries(queryClient);
  const saveMutation = useMutation({ ...saveAcademicCatalogItemMutationOptions(kind), onSettled });
  const deleteMutation = useMutation({
    ...deleteAcademicCatalogItemMutationOptions(kind),
    onSettled,
  });
  const restoreMutation = useMutation({
    ...restoreAcademicCatalogItemMutationOptions(kind),
    onSettled,
  });

  const save = async (
    id: string | undefined,
    body: AcademicCatalogWrite,
  ): Promise<AcademicCatalogItem | null> => {
    try {
      const saved = await saveMutation.mutateAsync({ id: id ?? crypto.randomUUID(), body });
      notify.success(t("academicCatalog.saved", { item }));
      return saved;
    } catch (error) {
      notify.error(t("academicCatalog.saveFailed", { item }), { description: errorDetail(error) });
      return null;
    }
  };

  const remove = async (target: AcademicCatalogItem): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(target.id);
      notify.info(t("academicCatalog.deletedToast", { item }));
      return true;
    } catch (error) {
      notify.error(t("academicCatalog.deleteFailed", { item }), {
        description: errorDetail(error),
      });
      return false;
    }
  };

  const restore = async (target: AcademicCatalogItem): Promise<boolean> => {
    try {
      await restoreMutation.mutateAsync(target.id);
      notify.success(t("academicCatalog.restored", { item }));
      return true;
    } catch (error) {
      notify.error(t("academicCatalog.restoreFailed", { item }), {
        description: errorDetail(error),
      });
      return false;
    }
  };

  return {
    save,
    remove,
    restore,
    isPending: saveMutation.isPending || deleteMutation.isPending || restoreMutation.isPending,
  };
}
