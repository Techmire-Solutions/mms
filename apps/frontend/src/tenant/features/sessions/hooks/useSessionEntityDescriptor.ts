import type { Session } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { sessionsEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<Session> with all labels
 * resolved through the active locale at call time.
 */
export function useSessionEntityDescriptor(): EntityDescriptor<Session> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    sessionsEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}
