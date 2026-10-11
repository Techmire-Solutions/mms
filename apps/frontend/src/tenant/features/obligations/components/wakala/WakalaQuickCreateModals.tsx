import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { MujtahidNameFormModal } from "@/tenant/features/obligations/components/MujtahidNameFormModal";
import { ObligationTypeFormModal } from "@/tenant/features/obligations/components/ObligationTypeFormModal";
import type { Mujtahid, MujtahidRep, ObligationType } from "@/lib/data/obligationsData";

interface WakalaQuickCreateModalsProps {
  isAddMujtahidOpen: boolean;
  onCloseAddMujtahid: () => void;
  onSaveMujtahid: (data: Partial<Mujtahid>) => Promise<void> | void;
  isAddRepOpen: boolean;
  onCloseAddRep: () => void;
  onSaveRep: (data: Partial<MujtahidRep>) => Promise<void> | void;
  isAddObTypeOpen: boolean;
  onCloseAddObType: () => void;
  onSaveObType: (data: Partial<ObligationType>) => Promise<void> | void;
}

export function WakalaQuickCreateModals({
  isAddMujtahidOpen,
  onCloseAddMujtahid,
  onSaveMujtahid,
  isAddRepOpen,
  onCloseAddRep,
  onSaveRep,
  isAddObTypeOpen,
  onCloseAddObType,
  onSaveObType,
}: WakalaQuickCreateModalsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {isAddMujtahidOpen && (
        <MujtahidNameFormModal
          title={t("obligations.mujtahids.addTitle")}
          label={t("obligations.mujtahids.nameLabel")}
          initial={{ name: "" }}
          onSave={onSaveMujtahid}
          onClose={onCloseAddMujtahid}
        />
      )}

      {isAddRepOpen && (
        <MujtahidNameFormModal
          title={t("obligations.mujtahids.repAddTitle")}
          label={t("obligations.mujtahids.repNameLabel")}
          initial={{ name: "" }}
          onSave={onSaveRep}
          onClose={onCloseAddRep}
        />
      )}

      {isAddObTypeOpen && (
        <ObligationTypeFormModal
          title={t("obligations.types.addTitle")}
          initial={{ name: "", designated_for: "Both", quantity_based: false }}
          onSave={onSaveObType}
          onClose={onCloseAddObType}
        />
      )}
    </>
  );
}
