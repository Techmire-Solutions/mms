import type { ComponentType } from "react";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Share2,
  GraduationCap,
  Briefcase,
  Award,
  Heart,
  FolderKanban,
  Landmark,
} from "lucide-react";
import {
  canViewContactTab,
  DEFAULT_FORM_TABS,
  type TabDefinition,
  type ValidationError,
} from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export const SYSTEM_TAB_ICONS: Record<string, ComponentType> = {
  basic: User,
  phones: Phone,
  emails: Mail,
  addresses: MapPin,
  social: Share2,
  socials: Share2,
  education: GraduationCap,
  experience: Briefcase,
  skills: Award,
  relationship: Heart,
  bankDetails: Landmark,
};

export function computeContactTabErrorCounts(
  validationErrors?: ValidationError[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!validationErrors || validationErrors.length === 0) return counts;
  for (const err of validationErrors) {
    const tabId = err.tabId || "basic";
    counts[tabId] = (counts[tabId] || 0) + 1;
  }
  return counts;
}

export function buildContactFormVisibleTabs({
  enabledTabIds,
  collectionCounts,
  tabErrorCounts,
  formTabs,
  viewerRole,
  t,
}: {
  enabledTabIds: Set<string>;
  collectionCounts: Record<string, number>;
  tabErrorCounts: Record<string, number>;
  /** Tenant tab registry (order/labels/enablement). Falls back to the static seed. */
  formTabs?: TabDefinition[];
  viewerRole?: string;
  t: TranslationFunction;
}) {
  const countMap: Record<string, number> = {
    phones: collectionCounts.filledPhones,
    emails: collectionCounts.filledEmails,
    addresses: collectionCounts.filledAddresses,
    social: collectionCounts.filledSocials,
    socials: collectionCounts.filledSocials,
    education: collectionCounts.filledEducation,
    experience: collectionCounts.filledExperience,
    skills: collectionCounts.filledSkills,
    relationship: collectionCounts.filledRelationships,
    bankDetails: collectionCounts.filledBankDetails,
  };

  const canonicalTabs: TabDefinition[] =
    formTabs && formTabs.length > 0
      ? [...formTabs].sort((left, right) => left.order - right.order)
      : DEFAULT_FORM_TABS.map((tab, index) => ({
          ...tab,
          enabled: true,
          order: index,
          isSystem: true,
        }));

  return canonicalTabs
    .filter((tab) => tab.enabled !== false)
    .filter((tab) => enabledTabIds.has(tab.key))
    .filter((tab) => !viewerRole || canViewContactTab(viewerRole, tab))
    .map((tab) => {
      const count = countMap[tab.key] ?? collectionCounts[tab.key];
      const errorCount = tabErrorCounts[tab.key];
      const hasErrors = Boolean(errorCount && errorCount > 0);
      const label = tab.labelKey ? t(tab.labelKey) : tab.label || tab.key;
      return {
        key: tab.key,
        icon: SYSTEM_TAB_ICONS[tab.key] ?? FolderKanban,
        label,
        badge: hasErrors ? errorCount : count && count > 0 ? count : undefined,
        tone: hasErrors ? ("destructive" as const) : undefined,
      };
    });
}

export interface ContactValidationSummaryItem {
  message: string;
  tabId?: string;
  fieldId?: string;
  index?: number;
}

/**
 * Deduped validation issues that can be focused: the summary banner renders these
 * as buttons, so each entry keeps the tab/field/index needed to jump to its control.
 */
export function buildContactValidationErrorItems(
  lookupsError: boolean,
  validationErrors: ValidationError[] | undefined,
  t: TranslationFunction,
): ContactValidationSummaryItem[] | undefined {
  if (lookupsError) return [{ message: t("contacts.form.lookupsLoadFailed") }];
  if (!validationErrors || validationErrors.length === 0) return undefined;
  const seen = new Set<string>();
  const items: ContactValidationSummaryItem[] = [];
  for (const err of validationErrors) {
    if (!err.message) continue;
    const key = `${err.fieldId ?? ""}|${err.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      message: err.message,
      tabId: err.tabId,
      fieldId: err.fieldId,
      index: err.index,
    });
  }
  return items.length > 0 ? items : undefined;
}

export function buildContactValidationErrorSummary(
  lookupsError: boolean,
  validationErrors: ValidationError[] | undefined,
  t: TranslationFunction,
): string[] | undefined {
  return buildContactValidationErrorItems(lookupsError, validationErrors, t)?.map(
    (item) => item.message,
  );
}
