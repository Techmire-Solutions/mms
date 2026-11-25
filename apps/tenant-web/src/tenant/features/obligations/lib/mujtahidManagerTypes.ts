export interface Mujtahid {
  id: string;
  name: string;
}

export interface MujtahidRep {
  id: string;
  mujtahid_id: string;
  name: string;
}

export interface MujtahidManagerProps {
  mujtahids: Mujtahid[];
  reps: MujtahidRep[];
  onChangeMujtahids: (mujtahids: Mujtahid[]) => void | Promise<void>;
  onChangeReps: (reps: MujtahidRep[]) => void | Promise<void>;
}

export interface ModalState {
  mode: "add" | "edit" | "add-rep" | "edit-rep";
  data: Partial<Mujtahid> | Partial<MujtahidRep>;
}
