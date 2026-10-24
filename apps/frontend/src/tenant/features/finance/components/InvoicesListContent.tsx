import type React from "react";

import { EmptyState } from "@/components/app/EmptyState";
import { InvoicesListCards } from "@/tenant/features/finance/components/InvoicesListCards";
import { InvoicesListDesktopTable } from "@/tenant/features/finance/components/InvoicesListDesktopTable";
import type { InvoicesListContentProps } from "@/tenant/features/finance/lib/invoicesListShared";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export function InvoicesListContent(props: InvoicesListContentProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {props.invoices.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={ReceiptText}
          title={t("finance.empty.invoicesTitle")}
          description={t("finance.empty.invoicesSubtitle")}
          compact
        />
      ) : props.viewMode === "cards" ? (
        <InvoicesListCards {...props} />
      ) : (
        <InvoicesListDesktopTable {...props} />
      )}
    </>
  );
}
