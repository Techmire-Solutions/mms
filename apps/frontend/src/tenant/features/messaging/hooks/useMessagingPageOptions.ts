import { getMessageCategoryLabelKey, MESSAGING_MODULE_MANIFEST } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";

export function useMessagingPageOptions() {
  const { t } = useTranslation();

  const categorySelectOptions = (() => [
    { value: "all", label: t("messaging.category.all") },
    ...MESSAGING_MODULE_MANIFEST.categoryOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })),
  ])();

  const templateCategorySelectOptions = (() =>
    MESSAGING_MODULE_MANIFEST.categoryOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })))();

  const channelSelectOptions = (() =>
    MESSAGING_MODULE_MANIFEST.channelOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })))();

  const roleOptions = (() =>
    MESSAGING_MODULE_MANIFEST.roleOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })))();

  const genderOptions = (() =>
    MESSAGING_MODULE_MANIFEST.genderOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })))();

  const statusOptions = (() =>
    MESSAGING_MODULE_MANIFEST.statusOptions.map((option) => ({
      value: option.value,
      label: t(option.labelKey),
    })))();

  const categoryBadgeConfig = (() => ({
    general: { label: t(getMessageCategoryLabelKey("general")), cls: SEMANTIC_BADGE.muted },
    academic: { label: t(getMessageCategoryLabelKey("academic")), cls: SEMANTIC_BADGE.info },
    financial: { label: t(getMessageCategoryLabelKey("financial")), cls: SEMANTIC_BADGE.success },
    attendance: { label: t(getMessageCategoryLabelKey("attendance")), cls: SEMANTIC_BADGE.warning },
    emergency: {
      label: t(getMessageCategoryLabelKey("emergency")),
      cls: SEMANTIC_BADGE.destructive,
    },
  }))() as Record<string, StatusBadgeConfigItem>;

  const logStatusConfig = (() => ({
    sent: { label: t("messaging.status.sent"), cls: SEMANTIC_BADGE.success },
    delivered: { label: t("messaging.status.delivered"), cls: SEMANTIC_BADGE.successStrong },
    failed: { label: t("messaging.status.failed"), cls: SEMANTIC_BADGE.destructive },
    skipped: { label: t("messaging.status.skipped"), cls: SEMANTIC_BADGE.muted },
  }))() as Record<string, StatusBadgeConfigItem>;

  return {
    categorySelectOptions,
    templateCategorySelectOptions,
    channelSelectOptions,
    roleOptions,
    genderOptions,
    statusOptions,
    categoryBadgeConfig,
    logStatusConfig,
  };
}
