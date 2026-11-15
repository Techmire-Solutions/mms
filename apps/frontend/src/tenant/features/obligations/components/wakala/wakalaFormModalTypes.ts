import type {
  Mujtahid,
  MujtahidRep,
  ObligationType,
  WakalaType,
  ObligationDistribution,
} from "@/lib/data/obligationsData";

export interface InitialDistRow {
  id: string;
  name: string;
  percentage: number | null;
  type: "Income" | "Liability";
  account_id?: string | null;
}

export interface WakalaFormModalProps {
  title: string;
  initial: Partial<WakalaType>;
  /** Existing split rules when editing; the modal re-hydrates them instead of starting empty. */
  initialDistributions?: InitialDistRow[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  obligationTypes: ObligationType[];
  onSave: (
    form: Partial<WakalaType>,
    initialDistributions?: Partial<ObligationDistribution>[],
  ) => Promise<unknown> | void;
  onClose: () => void;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => Promise<void> | void;
  onChangeReps?: (reps: MujtahidRep[]) => Promise<void> | void;
  onChangeTypes?: (types: ObligationType[]) => Promise<void> | void;
}
