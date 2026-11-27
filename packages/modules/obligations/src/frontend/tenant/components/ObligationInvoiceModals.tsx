import React, { lazy, Suspense } from "react";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
} from "../lib/obligationsData";

const PrintInvoiceModal: React.ComponentType<any> = lazy(() =>
  import("./invoice/PrintInvoiceModal").then((module: any) => ({
    default: module.PrintInvoiceModal,
  })),
);
const InvoiceTemplateEditor: React.ComponentType<any> = lazy(() =>
  import("./invoice/InvoiceTemplateEditor").then((module: any) => ({
    default: module.InvoiceTemplateEditor,
  })),
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
