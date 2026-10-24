import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObligationCollectionWakalaSection } from "./ObligationCollectionWakalaSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/components/selectors/UserActorSelect", () => ({
  UserActorSelect: () => <div data-testid="received-by" />,
}));

const form = {
  receipt_no: "",
  received_date: "",
  sender_id: "",
  reference_id: "",
  amount: "",
  currency_id: "cur1",
  payment_mode: "Cash",
  obligation_type_id: "ot1",
  mujtahid_representative_id: "",
  received_by: "u1",
};

describe("ObligationCollectionWakalaSection", () => {
  it("shows Plus on type and rep when canAdd callbacks are provided", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionWakalaSection
        form={form}
        setForm={vi.fn()}
        errors={{}}
        obligationTypes={[
          {
            id: "ot1",
            name: "Khums",
            designated_for: "Both",
            quantity_based: false,
          },
        ]}
        eligibleReps={[]}
        getMujtahid={() => null}
        selectedMujtahid={null}
        canAddType
        canAddRep
        onOpenAddType={vi.fn()}
        onOpenAddRep={vi.fn()}
        formField={(_key, _label, _required, children) => <>{children}</>}
      />,
    );
    expect(html).toContain('aria-label="obligations.types.addTitle"');
    expect(html).toContain('aria-label="obligations.mujtahids.repAddTitle"');
  });

  it("hides Plus when canAdd flags are false", () => {
    const html = renderToStaticMarkup(
      <ObligationCollectionWakalaSection
        form={form}
        setForm={vi.fn()}
        errors={{}}
        obligationTypes={[]}
        eligibleReps={[]}
        getMujtahid={() => null}
        selectedMujtahid={null}
        formField={(_key, _label, _required, children) => <>{children}</>}
      />,
    );
    expect(html).not.toContain('aria-label="obligations.types.addTitle"');
    expect(html).not.toContain('aria-label="obligations.mujtahids.repAddTitle"');
  });
});
