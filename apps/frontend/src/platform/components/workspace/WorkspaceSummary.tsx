import type { PlatformWorkspaceRow } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { ReviewList } from "@shared/ui";

export function WorkspaceSummary({
  workspace,
  showAdminEmail = false,
}: {
  workspace: PlatformWorkspaceRow;
  showAdminEmail?: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const fields = [
    { label: t("platform.descriptor.workspace.madrasaName"), value: workspace.madrasaName },
    { label: t("platform.descriptor.workspace.subdomain"), value: workspace.subdomain },
    ...(showAdminEmail
      ? [{ label: t("platform.adminEmailLabel"), value: workspace.adminEmail || "—" }]
      : []),
  ];
  return <ReviewList variant="compact" items={fields} />;
}
