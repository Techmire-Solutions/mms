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
import { DEFAULT_FORM_TABS, type ValidationError } from "@mms/shared";
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
  t,
}: {
  enabledTabIds: Set<string>;
  collectionCounts: Record<string, number>;
  tabErrorCounts: Record<string, number>;
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

  return DEFAULT_FORM_TABS.filter((sys) => enabledTabIds.has(sys.key)).map((sys) => {
    const count = countMap[sys.key];
    const errorCount = tabErrorCounts[sys.key];
    const hasErrors = Boolean(errorCount && errorCount > 0);
    const label = sys.labelKey ? t(sys.labelKey) : sys.label || sys.key;
    return {
      key: sys.key,
      icon: SYSTEM_TAB_ICONS[sys.key] ?? FolderKanban,
      label,
      badge: hasErrors ? errorCount : count && count > 0 ? count : undefined,
      tone: hasErrors ? ("destructive" as const) : undefined,
    };
  });
}

export function buildContactValidationErrorSummary(
  lookupsError: boolean,
  validationErrors: ValidationError[] | undefined,
  t: TranslationFunction,
): string[] | undefined {
  if (lookupsError) return [t("contacts.form.lookupsLoadFailed")];
  if (!validationErrors || validationErrors.length === 0) return undefined;
  const seen = new Set<string>();
  const messages: string[] = [];
  for (const err of validationErrors) {
    if (!err.message) continue;
    const key = `${err.fieldId ?? ""}|${err.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    messages.push(err.message);
  }
  return messages.length > 0 ? messages : undefined;
}
