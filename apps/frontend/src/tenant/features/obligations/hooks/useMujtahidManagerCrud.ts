import { useState } from "react";
import { generateClientEntityId } from "@mms/shared";
import type { ModalState, Mujtahid, MujtahidRep } from "../lib/mujtahidManagerTypes";

export interface UseMujtahidManagerCrudProps {
  mujtahids: Mujtahid[];
  reps: MujtahidRep[];
  onChangeMujtahids: (mujtahids: Mujtahid[]) => Promise<void> | void;
  onChangeReps: (reps: MujtahidRep[]) => Promise<void> | void;
}

export function useMujtahidManagerCrud({
  mujtahids,
  reps,
  onChangeMujtahids,
  onChangeReps,
}: UseMujtahidManagerCrudProps) {
  const [modal, setModal] = useState<ModalState | null>(null);
  const [deleteMujtahidId, setDeleteMujtahidId] = useState<string | null>(null);
  const [deleteRepId, setDeleteRepId] = useState<string | null>(null);

  const handleSaveMujtahid = async (form: Partial<Mujtahid>) => {
    if (modal?.mode === "add") {
      await onChangeMujtahids([
        ...mujtahids,
        { ...form, id: generateClientEntityId("m") } as Mujtahid,
      ]);
    } else if (modal?.mode === "edit") {
      await onChangeMujtahids(
        mujtahids.map((mujtahid) => (mujtahid.id === form.id ? (form as Mujtahid) : mujtahid)),
      );
    }
    setModal(null);
  };

  const handleConfirmDeleteMujtahid = async () => {
    if (!deleteMujtahidId) return;
    const targetId = deleteMujtahidId;
    await onChangeMujtahids(mujtahids.filter((mujtahid) => mujtahid.id !== targetId));
    await onChangeReps(reps.filter((representative) => representative.mujtahid_id !== targetId));
    setDeleteMujtahidId(null);
  };

  const handleSaveRep = async (form: Partial<MujtahidRep>) => {
    if (modal?.mode === "add-rep") {
      await onChangeReps([...reps, { ...form, id: generateClientEntityId("mr") } as MujtahidRep]);
    } else if (modal?.mode === "edit-rep") {
      await onChangeReps(
        reps.map((representative) =>
          representative.id === form.id ? (form as MujtahidRep) : representative,
        ),
      );
    }
    setModal(null);
  };

  const handleConfirmDeleteRep = async () => {
    if (!deleteRepId) return;
    const targetId = deleteRepId;
    await onChangeReps(reps.filter((representative) => representative.id !== targetId));
    setDeleteRepId(null);
  };

  return {
    modal,
    setModal,
    deleteMujtahidId,
    setDeleteMujtahidId,
    deleteRepId,
    setDeleteRepId,
    handleSaveMujtahid,
    handleConfirmDeleteMujtahid,
    handleSaveRep,
    handleConfirmDeleteRep,
  };
}
