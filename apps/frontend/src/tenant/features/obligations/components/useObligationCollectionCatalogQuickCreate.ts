import { useState } from "react";
import { generateClientEntityId } from "@mms/shared";
import type { Mujtahid, MujtahidRep, ObligationType, WakalaType } from "@/lib/data/obligationsData";

export interface ObligationCollectionCatalogQuickCreateArgs {
  obligationTypes: ObligationType[];
  mujtahids: Mujtahid[];
  reps: MujtahidRep[];
  wakalaTypes: WakalaType[];
  selectedObligationTypeId: string;
  onChangeTypes?: (types: ObligationType[]) => Promise<void> | void;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => Promise<void> | void;
  onChangeReps?: (reps: MujtahidRep[]) => Promise<void> | void;
  onChangeWakala?: (wakala: WakalaType[]) => Promise<void> | void;
  onSelectType: (obligationTypeId: string) => void;
  onSelectRep: (repId: string) => void;
}

/** Nested Wakala catalog create for obligation collection type/rep selects. */
export function useObligationCollectionCatalogQuickCreate({
  obligationTypes,
  mujtahids,
  reps,
  wakalaTypes,
  selectedObligationTypeId,
  onChangeTypes,
  onChangeMujtahids,
  onChangeReps,
  onChangeWakala,
  onSelectType,
  onSelectRep,
}: ObligationCollectionCatalogQuickCreateArgs) {
  const [isAddObTypeOpen, setIsAddObTypeOpen] = useState(false);
  const [isAddMujtahidOpen, setIsAddMujtahidOpen] = useState(false);
  const [isAddRepOpen, setIsAddRepOpen] = useState(false);
  const [pendingMujtahidId, setPendingMujtahidId] = useState("");

  const canAddType = typeof onChangeTypes === "function";
  const canAddRep = typeof onChangeReps === "function" && typeof onChangeMujtahids === "function";
  const isChildModalOpen = isAddObTypeOpen || isAddMujtahidOpen || isAddRepOpen;

  async function handleSaveObType(newType: Partial<ObligationType>): Promise<void> {
    if (!onChangeTypes) return;
    const id = generateClientEntityId("ot");
    const created: ObligationType = {
      ...newType,
      id,
      name: newType.name || "",
      designated_for: newType.designated_for || "Both",
      quantity_based: !!newType.quantity_based,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as ObligationType;
    await onChangeTypes([...obligationTypes, created]);
    onSelectType(id);
    setIsAddObTypeOpen(false);
  }

  async function handleSaveMujtahid(newMujtahid: Partial<Mujtahid>): Promise<void> {
    if (!onChangeMujtahids) return;
    const id = generateClientEntityId("m");
    await onChangeMujtahids([...mujtahids, { ...newMujtahid, id } as Mujtahid]);
    setPendingMujtahidId(id);
    setIsAddMujtahidOpen(false);
    setIsAddRepOpen(true);
  }

  async function handleSaveRep(newRep: Partial<MujtahidRep>): Promise<void> {
    if (!onChangeReps || !pendingMujtahidId) return;
    const id = generateClientEntityId("mr");
    await onChangeReps([...reps, { ...newRep, id, mujtahid_id: pendingMujtahidId } as MujtahidRep]);
    if (selectedObligationTypeId && onChangeWakala) {
      const wakalaId = generateClientEntityId("wt");
      await onChangeWakala([
        ...wakalaTypes,
        {
          id: wakalaId,
          mujtahid_representative_id: id,
          obligation_type_id: selectedObligationTypeId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
    }
    onSelectRep(id);
    setPendingMujtahidId("");
    setIsAddRepOpen(false);
  }

  return {
    canAddType,
    canAddRep,
    isChildModalOpen,
    isAddObTypeOpen,
    isAddMujtahidOpen,
    isAddRepOpen,
    openAddType: () => setIsAddObTypeOpen(true),
    openAddRep: () => {
      setPendingMujtahidId("");
      setIsAddMujtahidOpen(true);
    },
    closeAddObType: () => setIsAddObTypeOpen(false),
    closeAddMujtahid: () => {
      setIsAddMujtahidOpen(false);
      setPendingMujtahidId("");
    },
    closeAddRep: () => {
      setIsAddRepOpen(false);
      setPendingMujtahidId("");
    },
    handleSaveObType,
    handleSaveMujtahid,
    handleSaveRep,
  };
}
