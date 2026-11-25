import type React from "react";
import { Send } from "lucide-react";
import { EmptyState } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { DistributionsListCards } from "./DistributionsListCards.js";
import { DistributionsListDesktopTable } from "./DistributionsListDesktopTable.js";
import type { DistributionsListContentProps } from "../lib/distributionsListShared";

export function DistributionsListContent(props: DistributionsListContentProps): React.JSX.Element {
  const { t } = useTranslation();

  if (props.distributions.length === 0) {
    return (
      <EmptyState variant="dashed" icon={Send} title={t("hasanat.empty.distributions")} compact />
    );
  }

  return props.viewMode === "cards" ? (
    <DistributionsListCards {...props} />
  ) : (
    <DistributionsListDesktopTable {...props} />
  );
}
