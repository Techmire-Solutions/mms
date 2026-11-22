/**
 * @file useIndustryTerminology.ts
 * @description Resolves industry terminology profile for UI labels (no DB renames).
 */

import { getTerminologyForIndustry } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { getCurrentSubdomain } from "@/lib/config/tenantConfig";
import {
  useWorkspaceBySubdomain,
  type PublicWorkspace,
} from "@/tenant/hooks/useWorkspaceBySubdomain";
import type { ResolvedIndustryTerminology } from "@/lib/config/navLabels";

export { resolveNavLabel, type ResolvedIndustryTerminology } from "@/lib/config/navLabels";

export function useIndustryTerminology(): ResolvedIndustryTerminology {
  const { t } = useTranslation();
  const subdomain = getCurrentSubdomain();
  const { data } = useWorkspaceBySubdomain(subdomain, Boolean(subdomain));
  const industryType = data?.body?.workspace
    ? (data.body.workspace as PublicWorkspace).industryType
    : undefined;
  const keys = getTerminologyForIndustry(industryType);
  return {
    facultyLabel: t(keys.facultyLabelKey),
    staffSingular: t(keys.staffSingularKey),
    studentLabel: t(keys.studentLabelKey),
    locationLabel: t(keys.locationLabelKey),
  };
}
