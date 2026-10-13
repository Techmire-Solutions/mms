import type { AppTranslationKey } from "@mms/shared";
import { type ObligationType } from "@/lib/data/obligationsData";

export type DesignatedFor = "Syed" | "Non-Syed" | "Both" | "None";

export const DESIGNATED_LABEL_KEYS: Record<DesignatedFor, AppTranslationKey> = {
  Syed: "obligations.designated.syed",
  "Non-Syed": "obligations.designated.nonSyed",
  Both: "obligations.designated.both",
  None: "obligations.designated.none",
};

export const OBLIGATION_TYPE_EMPTY: Partial<ObligationType> = {
  name: "",
  quantity_based: false,
  designated_for: "Both",
};

export interface ObligationTypeModalState {
  mode: "add" | "edit";
  data: Partial<ObligationType>;
}
