import type { AppTranslationKey } from "@mms/shared";

export interface MessagingDirectoryCopy {
  titleKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  /** The first-run campaign CTA only belongs to the empty active directory. */
  showFirstRunAction: boolean;
}

/**
 * Empty-directory copy for the messaging Work tier.
 *
 * Archived view is a distinct state: it must not borrow the active-view
 * "select recipients to compose" copy nor offer the campaign CTA.
 */
export function resolveMessagingDirectoryCopy({
  showArchived,
  hasActiveFilters,
}: {
  showArchived: boolean;
  hasActiveFilters: boolean;
}): MessagingDirectoryCopy {
  if (showArchived && !hasActiveFilters) {
    return {
      titleKey: "messaging.archivedEmpty",
      descriptionKey: "messaging.archivedEmptyDesc",
      showFirstRunAction: false,
    };
  }
  if (hasActiveFilters) {
    return {
      titleKey: "messaging.noLogsMatchFilters",
      descriptionKey: "messaging.tryAdjustingFilters",
      showFirstRunAction: false,
    };
  }
  return {
    titleKey: "messaging.noLogs",
    descriptionKey: "messaging.selectRecipientsDesc",
    showFirstRunAction: true,
  };
}
