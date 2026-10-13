import React from "react";
import { Receipt, Printer } from "lucide-react";
import type {
  ObligationCollection,
  ObligationType,
  MujtahidRep,
  Mujtahid,
  WakalaType,
  ObligationDistribution,
} from "@/lib/data/obligationsData";
import { formatDate } from "@mms/shared";
import { Drawer } from "@/components/app/Drawer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { ObligationInvoiceModals } from "./ObligationInvoiceModals";
import { useObligationCollectionDetailModel } from "./detail/useObligationCollectionDetailModel";
import { ObligationCollectionAttributesCard } from "./detail/ObligationCollectionAttributesCard";
import { ObligationCollectionDistributionsSection } from "./detail/ObligationCollectionDistributionsSection";

export interface ObligationCollectionDetailProps {
  collection: ObligationCollection;
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  distributions: ObligationDistribution[];
  wakalaTypes: WakalaType[];
  onClose: () => void;
  canDelete?: boolean;
  onRestore?: (id: string) => void | Promise<void>;
}

/**
 * Displays obligation collection details including distribution breakdown.
 */
export const ObligationCollectionDetail = function ObligationCollectionDetail({
  collection,
  obligationTypes,
  reps,
  mujtahids,
  distributions,
  wakalaTypes,
  onClose,
  canDelete = false,
  onRestore,
}: ObligationCollectionDetailProps): React.JSX.Element {
  const {
    t,
    currency,
    sender,
    reference,
    user,
    rep,
    mujtahid,
    obType,
    wakalaType,
    dists,
    totalPct,
    totalAmount,
    isArchived,
    paymentModeConfig,
    distributionTypeConfig,
    showPrint,
    setShowPrint,
    showEditor,
    setShowEditor,
    editorFromPrint,
    setEditorFromPrint,
  } = useObligationCollectionDetailModel({
    collection,
    obligationTypes,
    reps,
    mujtahids,
    distributions,
    wakalaTypes,
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title={t("obligations.detail.title")}
      icon={Receipt}
      className="max-w-2xl"
      headerExtra={
        isArchived ? <DetailDrawerArchivedBanner deletedAt={collection.deletedAt} /> : undefined
      }
      headerActions={
        onRestore ? (
          <DetailDrawerRestoreOrEditAction
            isArchived={isArchived}
            canRestore={canDelete}
            onRestore={() => onRestore(collection.id)}
            restoreLabel={t("common.restore")}
          />
        ) : undefined
      }
    >
      <div className="space-y-5">
        <Card className="p-4 flex items-center gap-3.5 bg-primary/5 border-primary/25">
          <Receipt className="w-5 h-5 text-primary" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide m-0">
              {t("obligations.columns.receiptNo")}
            </p>
            <p className="text-xl font-bold text-primary font-mono m-0">{collection.receipt_no}</p>
          </div>
          <div className="ms-auto text-end">
            <p className="text-xs font-semibold text-muted-foreground uppercase m-0">
              {t("obligations.columns.receivedDate")}
            </p>
            <p className="text-sm font-semibold text-foreground m-0">
              {formatDate(collection.received_date)}
            </p>
          </div>
        </Card>

        <ObligationCollectionAttributesCard
          collection={collection}
          sender={sender}
          reference={reference}
          obType={obType}
          rep={rep}
          mujtahid={mujtahid}
          currency={currency}
          paymentModeConfig={paymentModeConfig}
          user={user}
        />

        <ObligationCollectionDistributionsSection
          collection={collection}
          dists={dists}
          wakalaType={wakalaType}
          totalPct={totalPct}
          totalAmount={totalAmount}
          currency={currency}
          distributionTypeConfig={distributionTypeConfig}
        />

        <footer className="flex flex-wrap items-center justify-between gap-2">
          {!isArchived && (
            <Button type="button" onClick={() => setShowPrint(true)} className="gap-2">
              <Printer className="w-4 h-4" aria-hidden="true" />{" "}
              {t("obligations.actions.printShort")}
            </Button>
          )}
          <Button type="button" onClick={onClose} variant="outline">
            {t("common.close")}
          </Button>
        </footer>
      </div>

      <ObligationInvoiceModals
        printCollection={showPrint ? collection : null}
        editorCollection={showEditor ? collection : null}
        showEditor={showEditor}
        obligationTypes={obligationTypes}
        reps={reps}
        mujtahids={mujtahids}
        onClosePrint={() => setShowPrint(false)}
        onOpenEditor={() => {
          setShowPrint(false);
          setEditorFromPrint(true);
          setShowEditor(true);
        }}
        onCloseEditor={() => {
          setShowEditor(false);
          if (editorFromPrint) {
            setEditorFromPrint(false);
            setShowPrint(true);
          }
        }}
      />
    </Drawer>
  );
};
