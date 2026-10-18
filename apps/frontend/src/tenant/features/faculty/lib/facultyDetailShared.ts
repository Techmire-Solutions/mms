import {
  Award,
  BadgeCheck,
  Briefcase,
  Building,
  Calendar,
  GraduationCap,
  Hash,
  Network,
  Star,
  User,
  type LucideIcon,
} from "lucide-react";
import { FACULTY_TAB_REGISTRY, type FacultySettings } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { resolveRegistryLabel } from "@/lib/contacts/contactI18n";

export const SYSTEM_FIELD_ICONS: Record<string, LucideIcon> = {
  contactId: User,
  employeeId: Hash,
  specialization: Briefcase,
  qualification: GraduationCap,
  joinDate: Calendar,
  employmentStartDate: Calendar,
  employmentEndDate: Calendar,
  performanceRating: Star,
  status: Briefcase,
  department: Building,
  designation: Award,
  hierarchyRank: BadgeCheck,
  reportingFacultyId: Network,
};

/** Resolve a tab key to its translated section title (Students grouped-fields parity). */
export function resolveFacultyTabLabel(
  settings: FacultySettings,
  tabId: string,
  t: TranslationFunction,
): string {
  const tabs =
    settings.formTabs && settings.formTabs.length > 0 ? settings.formTabs : FACULTY_TAB_REGISTRY;
  const tab = tabs.find((candidate) => candidate.key === tabId);
  if (!tab) return tabId;
  return resolveRegistryLabel({ label: tab.label, labelKey: tab.labelKey }, t);
}
