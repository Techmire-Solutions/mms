import {
  type WakalaType,
  type ObligationDistribution,
  type ObligationType,
  type MujtahidRep,
  type Mujtahid,
} from "@/lib/data/obligationsData";

export type DistributionType = "Income" | "Liability";

export interface WakalaTypeManagerProps {
  wakalaTypes: WakalaType[];
  distributions: ObligationDistribution[];
  obligationTypes: ObligationType[];
  reps: MujtahidRep[];
  mujtahids: Mujtahid[];
  onChangeWakala: (wt: WakalaType[]) => void | Promise<void>;
  onChangeDistributions: (dists: ObligationDistribution[]) => void | Promise<void>;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => void | Promise<void>;
  onChangeReps?: (reps: MujtahidRep[]) => void | Promise<void>;
  onChangeTypes?: (types: ObligationType[]) => void | Promise<void>;
}
