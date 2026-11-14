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
  /**
   * Saves a wakala and its rules in one transaction. A wakala with no rules makes the ledger fall
   * back to the default income account, so the two half-writes below are only a legacy fallback.
   */
  onSaveAggregate?: (input: {
    wakalaTypes: WakalaType[];
    distributions: ObligationDistribution[];
  }) => Promise<void>;
  onChangeMujtahids?: (mujtahids: Mujtahid[]) => void | Promise<void>;
  onChangeReps?: (reps: MujtahidRep[]) => void | Promise<void>;
  onChangeTypes?: (types: ObligationType[]) => void | Promise<void>;
}
