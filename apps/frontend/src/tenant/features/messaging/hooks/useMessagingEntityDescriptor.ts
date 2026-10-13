import type { MessageRecordDto } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { messagingEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/** i18n-resolved messaging entity descriptor for Work filter chips. */
export function useMessagingEntityDescriptor(): EntityDescriptor<MessageRecordDto> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    messagingEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}
