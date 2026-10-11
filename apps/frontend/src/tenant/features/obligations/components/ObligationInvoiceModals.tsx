import React, { lazy, Suspense } from "react";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "@/lib/data/obligationsData";

const PrintInvoiceModal = lazy(() =>
  import("@/tenant/features/obligations/components/invoice/PrintInvoiceModal").then((module) => ({
    default: module.PrintInvoiceModal,
  })),
);
const InvoiceTemplateEditor = lazy(() =>
  import("@/tenant/features/obligations/components/invoice/InvoiceTemplateEditor").then(
    (module) => ({
      default: module.InvoiceTemplateEditor,
    }),
  ),
);

export interface ObligationInvoiceModalsProps {
  printCollection: ObligationCollection | null;
  editorCollection: ObligationCollection | null;
  showEditor: boolean;
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  onClosePrint: () => void;
  onOpenEditor: (collection: ObligationCollection) => void;
  onCloseEditor: () => void;
}

export function ObligationInvoiceModals({
  printCollection,
  editorCollection,
  showEditor,
  obligationTypes,
  reps,
  mujtahids,
  onClosePrint,
  onOpenEditor,
  onCloseEditor,
}: ObligationInvoiceModalsProps): React.JSX.Element {
  return (
    <>
      {printCollection && (
        <Suspense fallback={null}>
          <PrintInvoiceModal
            collection={printCollection}
            obligationTypes={obligationTypes}
            reps={reps}
            mujtahids={mujtahids}
            onClose={onClosePrint}
            onOpenEditor={() => onOpenEditor(printCollection)}
          />
        </Suspense>
      )}

      {showEditor && (
        <Suspense fallback={null}>
          <InvoiceTemplateEditor
            collection={editorCollection}
            obligationTypes={obligationTypes}
            reps={reps}
            mujtahids={mujtahids}
            onClose={onCloseEditor}
          />
        </Suspense>
      )}
    </>
  );
}
