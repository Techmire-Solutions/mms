import React, { lazy } from "react";
import { AnimatePresence } from "framer-motion";
import type { MessageComposerProps } from "@/tenant/components/messaging/TenantMessageComposer";
import type {
  ObligationCollection,
  ObligationDistribution,
  ObligationType,
  Mujtahid,
  MujtahidRep,
  WakalaType,
} from "@/lib/data/obligationsData";

const ObligationCollectionDetail = lazy(() =>
  import("@/tenant/features/obligations/components/ObligationCollectionDetail").then((m) => ({
    default: m.ObligationCollectionDetail,
  })),
);
const ObligationCollectionForm = lazy(() =>
  import("@/tenant/features/obligations/components/ObligationCollectionForm").then((m) => ({
    default: m.ObligationCollectionForm,
  })),
);

const MessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

interface MessagingTarget {
  channel: "sms" | "whatsapp" | "email";
  recipients: MessageComposerProps["recipients"];
}

interface ObligationsModalLayerProps {
  showForm: boolean;
  canWrite: boolean;
  showDeleted: boolean;
  canDelete?: boolean;
  viewCollection: ObligationCollection | null;
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  wakalaTypes: WakalaType[];
  distributions: ObligationDistribution[];
  collections: ObligationCollection[];
  messagingTarget: MessagingTarget | null;
  onSaveCollection: (collection: ObligationCollection) => Promise<void>;
  onChangeTypes?: (types: ObligationType[]) => Promise<void> | void;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => Promise<void> | void;
  onChangeReps?: (reps: MujtahidRep[]) => Promise<void> | void;
  onChangeWakala?: (wakala: WakalaType[]) => Promise<void> | void;
  onRestore?: (id: string) => void | Promise<void>;
  onCloseForm: () => void;
  onCloseDetail: () => void;
  onCloseComposer: () => void;
}

export function ObligationsModalLayer({
  showForm,
  canWrite,
  showDeleted,
  canDelete = false,
  viewCollection,
  obligationTypes,
  reps,
  mujtahids,
  wakalaTypes,
  distributions,
  collections,
  messagingTarget,
  onSaveCollection,
  onChangeTypes,
  onChangeMujtahids,
  onChangeReps,
  onChangeWakala,
  onRestore,
  onCloseForm,
  onCloseDetail,
  onCloseComposer,
}: ObligationsModalLayerProps) {
  return (
    <>
      <AnimatePresence>
        {showForm && canWrite && !showDeleted && (
          <React.Suspense fallback={null}>
            <ObligationCollectionForm
              obligationTypes={obligationTypes}
              reps={reps}
              mujtahids={mujtahids}
              wakalaTypes={wakalaTypes}
              existingCollections={collections}
              onSave={onSaveCollection}
              onChangeTypes={onChangeTypes}
              onChangeMujtahids={onChangeMujtahids}
              onChangeReps={onChangeReps}
              onChangeWakala={onChangeWakala}
              onClose={onCloseForm}
            />
          </React.Suspense>
        )}
        {viewCollection && (
          <React.Suspense fallback={null}>
            <ObligationCollectionDetail
              collection={viewCollection}
              obligationTypes={obligationTypes}
              reps={reps}
              mujtahids={mujtahids}
              wakalaTypes={wakalaTypes}
              distributions={distributions}
              canDelete={canDelete}
              onRestore={onRestore}
              onClose={onCloseDetail}
            />
          </React.Suspense>
        )}
      </AnimatePresence>

      {messagingTarget && (
        <React.Suspense fallback={null}>
          <MessageComposer
            channel={messagingTarget.channel}
            recipients={messagingTarget.recipients}
            onClose={onCloseComposer}
          />
        </React.Suspense>
      )}
    </>
  );
}
