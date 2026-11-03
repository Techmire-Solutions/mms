import { useMemo } from "react";
import { getMessageCategoryLabelKey, MESSAGING_MODULE_MANIFEST } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

/**
 * Select/badge option surfaces for the Messaging page.
 *
 * Every derived array/record is memoized: these objects feed the memoized table
 * column registry, so a fresh identity per render would rebuild every column on
 * each keystroke.
 */
export function useMessagingPageOptions() {
  const { t } = useTranslation();

  const categorySelectOptions = useMemo(
    () => [
      { value: "all", label: t("messaging.category.all") },
      ...MESSAGING_MODULE_MANIFEST.categoryOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    ],
    [t],
  );

  const templateCategorySelectOptions = useMemo(
    () =>
      MESSAGING_MODULE_MANIFEST.categoryOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const channelSelectOptions = useMemo(
    () =>
      MESSAGING_MODULE_MANIFEST.channelOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const roleOptions = useMemo(
    () =>
      MESSAGING_MODULE_MANIFEST.roleOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const genderOptions = useMemo(
    () =>
      MESSAGING_MODULE_MANIFEST.genderOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const statusOptions = useMemo(
    () =>
      MESSAGING_MODULE_MANIFEST.statusOptions.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [t],
  );

  const categoryBadgeConfig = useMemo(
    () =>
      ({
        general: { label: t(getMessageCategoryLabelKey("general")), cls: SEMANTIC_BADGE.muted },
        academic: { label: t(getMessageCategoryLabelKey("academic")), cls: SEMANTIC_BADGE.info },
        financial: {
          label: t(getMessageCategoryLabelKey("financial")),
          cls: SEMANTIC_BADGE.success,
        },
        attendance: {
          label: t(getMessageCategoryLabelKey("attendance")),
          cls: SEMANTIC_BADGE.warning,
        },
        emergency: {
          label: t(getMessageCategoryLabelKey("emergency")),
          cls: SEMANTIC_BADGE.destructive,
        },
      }) as Record<string, StatusBadgeConfigItem>,
    [t],
  );

  const logStatusConfig = useMemo(
    () =>
      ({
        sending: { label: t("messaging.status.sending"), cls: SEMANTIC_BADGE.info },
        sent: { label: t("messaging.status.sent"), cls: SEMANTIC_BADGE.success },
        delivered: { label: t("messaging.status.delivered"), cls: SEMANTIC_BADGE.successStrong },
        failed: { label: t("messaging.status.failed"), cls: SEMANTIC_BADGE.destructive },
        skipped: { label: t("messaging.status.skipped"), cls: SEMANTIC_BADGE.muted },
      }) as Record<string, StatusBadgeConfigItem>,
    [t],
  );

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
