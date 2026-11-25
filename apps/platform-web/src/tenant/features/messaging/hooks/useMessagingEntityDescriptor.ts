import type { MessageRecordDto } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { messagingEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@mms/fe-core/i18n";

/** i18n-resolved messaging entity descriptor for Work filter chips. */
export function useMessagingEntityDescriptor(): EntityDescriptor<MessageRecordDto> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(messagingEntityDescriptor, (key) =>
    t(key as Parameters<typeof t>[0]),
  );
}
