import type React from "react";

import { EmptyState } from "@mms/ui";
import { InvoicesListCards } from "./InvoicesListCards";
import { InvoicesListDesktopTable } from "./InvoicesListDesktopTable";
import type { InvoicesListContentProps } from "../lib/invoicesListShared";
import { ReceiptText } from "lucide-react";
import { useTranslation } from "@mms/fe-core/i18n";

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
