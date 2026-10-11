/**
 * @file useIndustryTerminology.ts
 * @description Resolves industry terminology profile for UI labels (no DB renames).
 */

import { getTerminologyForIndustry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { getCurrentSubdomain } from "@/lib/config/tenantConfig";
import { useWorkspaceBySubdomain } from "@/tenant/hooks/useWorkspaceBySubdomain";

/** Resolved, locale-aware industry terminology labels. */
export interface ResolvedIndustryTerminology {
  facultyLabel: string;
  staffSingular: string;
  studentLabel: string;
  locationLabel: string;
}

export function useIndustryTerminology(): ResolvedIndustryTerminology {
  const { t } = useTranslation();
  const subdomain = getCurrentSubdomain();
  const { data } = useWorkspaceBySubdomain(subdomain, Boolean(subdomain));
  const industryType = data?.body?.workspace
    ? (data.body.workspace as { industryType?: string }).industryType
    : undefined;
  const keys = getTerminologyForIndustry(industryType);
  return {
    facultyLabel: t(keys.facultyLabelKey),
    staffSingular: t(keys.staffSingularKey),
    studentLabel: t(keys.studentLabelKey),
    locationLabel: t(keys.locationLabelKey),
  };
}
