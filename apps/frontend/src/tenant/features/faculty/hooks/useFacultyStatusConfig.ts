import { resolveFacultySpecializations, resolveFacultyStatuses } from "@mms/shared";
import { useFacultyConfig } from "@/hooks/useStandardModuleConfig";
import { useTranslation } from "@/hooks/useTranslation";
import { facultyStatusBadgeConfig } from "@/lib/faculty/facultyStatusUi";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

const resolveStatuses = resolveFacultyStatuses;
const resolveSpecs = resolveFacultySpecializations;

/**
 * SSOT for the faculty StatusBadge config, derived from the tenant's configured statuses.
 * Consolidates the repeated `facultyStatusBadgeConfig(t, statuses)` across list, form, and detail.
 */
export function useFacultyStatusConfig(): Record<string, StatusBadgeConfigItem> {
  const { t } = useTranslation();
  const { statuses } = useFacultyConfig();
  return (() => facultyStatusBadgeConfig(t, statuses))();
}

/**
 * SSOT for faculty status and specialization option lists from tenant lookups.
 * Departments and designations come from normalized catalogs, not lookups.
 */
export function useFacultyLookupOptions(): {
  statusOptions: string[];
  specializationOptions: string[];
} {
  const { statuses, specializations } = useFacultyConfig();
  return (() => ({
    statusOptions: [...resolveStatuses(statuses)],
    specializationOptions: [...resolveSpecs(specializations)],
  }))();
}
