import type { PostingRules } from "@mms/shared";

/** DOM ids the setup guide scrolls to after switching tabs. */
export const FX_SETUP_ANCHORS = {
  currencies: "accounting-fx-currencies-heading",
  rates: "accounting-fx-rates-heading",
  accounts: "accounting-fx-posting-heading",
} as const;

export type FxSetupStepId = keyof typeof FX_SETUP_ANCHORS;

/** Who may complete a step: currency policy is Setup (admin); daily rates are accounting work. */
export type FxSetupOwner = "admin" | "accountant";

export const FX_POSTING_ACCOUNT_FIELDS = [
  "fxRealizedAccountId",
  "fxUnrealizedAccountId",
  "fxRoundingAccountId",
] as const;

export type FxPostingAccountField = (typeof FX_POSTING_ACCOUNT_FIELDS)[number];

export interface FxSetupStep {
  id: FxSetupStepId;
  owner: FxSetupOwner;
  done: boolean;
  /** Still being checked (rate lookups or rules in flight). */
  pending: boolean;
  /** Waiting on an earlier step (no currency enabled yet). */
  blocked: boolean;
  /** The viewer holds the permission this step needs. */
  canAct: boolean;
  /** Currency codes without a rate, or posting-rule fields left empty. */
  missing: string[];
}

export interface FxSetupReadinessInput {
  enabledCurrencies: readonly string[];
  /** Currency → a rate is in force today; `undefined` while the lookup is in flight. */
  rateOnFile: ReadonlyMap<string, boolean | undefined>;
  postingRules: Pick<PostingRules, FxPostingAccountField> | undefined;
  canEditSetup: boolean;
  canWrite: boolean;
}

export interface FxSetupReadiness {
  steps: FxSetupStep[];
  completed: number;
  /** At least one foreign currency is enabled. */
  started: boolean;
  ready: boolean;
}

export function computeFxSetupReadiness(input: FxSetupReadinessInput): FxSetupReadiness {
  const started = input.enabledCurrencies.length > 0;
  const rateStates = input.enabledCurrencies.map((code) => input.rateOnFile.get(code));
  const missingRates = input.enabledCurrencies.filter(
    (code) => input.rateOnFile.get(code) === false,
  );
  const missingAccounts = input.postingRules
    ? FX_POSTING_ACCOUNT_FIELDS.filter((field) => !input.postingRules?.[field])
    : [];

  const steps: FxSetupStep[] = [
    {
      id: "currencies",
      owner: "admin",
      done: started,
      pending: false,
      blocked: false,
      canAct: input.canEditSetup,
      missing: [],
    },
    {
      id: "rates",
      owner: "accountant",
      done: started && rateStates.every((state) => state === true),
      pending: started && rateStates.some((state) => state === undefined),
      blocked: !started,
      canAct: input.canWrite,
      missing: missingRates,
    },
    {
      id: "accounts",
      owner: "admin",
      done: input.postingRules !== undefined && missingAccounts.length === 0,
      pending: input.postingRules === undefined,
      blocked: false,
      canAct: input.canEditSetup,
      missing: missingAccounts,
    },
  ];
  const completed = steps.filter((step) => step.done).length;
  return { steps, completed, started, ready: completed === steps.length };
}
