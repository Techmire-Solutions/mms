import type { AppTranslationKey } from "@mms/contracts";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/** Resolved, locale-aware industry terminology labels. */
export interface ResolvedIndustryTerminology {
  facultyLabel: string;
  staffSingular: string;
  studentLabel: string;
  locationLabel: string;
}

/**
 * Resolve a navigation label with industry terminology overrides applied.
 * Faculty/Students surface the workspace's industry profile label; all other
 * nav keys fall through to the plain translation. Shared by the desktop sidebar,
 * the mobile drawer, and the command palette so all surfaces render identical
 * labels. Lives in `lib` (not `tenant`) so shared UI can import it directly.
 */
export function resolveNavLabel(
  labelKey: AppTranslationKey,
  terminology: ResolvedIndustryTerminology,
  t: TranslationFunction,
): string {
  if (labelKey === "nav.faculty") return terminology.facultyLabel;
  if (labelKey === "nav.students") return terminology.studentLabel;
  // Nav labels are parameter-free; the cast selects the no-params `t` overload
  // (avoids the union-with-params overload that rejects a bare `AppTranslationKey`).
  return t(labelKey as "nav.dashboard");
}
