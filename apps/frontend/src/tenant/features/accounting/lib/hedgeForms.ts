import { todayISO, type HedgeRelationshipCreate } from "@mms/shared";

/** Editable designation form state; an empty reserve account means none. */
export type HedgeDesignationDraft = Omit<HedgeRelationshipCreate, "reserveAccountId"> & {
  reserveAccountId: string;
};

export function emptyHedgeDesignationDraft(): HedgeDesignationDraft {
  return {
    name: "",
    hedgeType: "cash_flow",
    direction: "buy",
    currency: "",
    notional: "",
    contractRate: "",
    designationRate: "",
    designationDate: todayISO(),
    maturityDate: "",
    hedgedItem: "",
    riskManagementObjective: "",
    instrumentAccountId: "",
    reserveAccountId: "",
    pnlAccountId: "",
  };
}

export function hedgeDesignationToRecord(draft: HedgeDesignationDraft): HedgeRelationshipCreate {
  return {
    ...draft,
    notional: draft.notional.trim(),
    contractRate: draft.contractRate.trim(),
    designationRate: draft.designationRate.trim(),
    reserveAccountId:
      draft.hedgeType === "cash_flow" && draft.reserveAccountId ? draft.reserveAccountId : null,
  };
}

export type HedgeAction = "settle" | "reclassify";

/** Settlement (date, rate, cash account) or reclassification (date, target account) input. */
export interface HedgeActionInput {
  date: string;
  rate: string;
  accountId: string;
}
