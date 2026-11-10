import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RedemptionTracker } from "./RedemptionTracker";
import type { Distribution, Redemption } from "@/lib/data/hasanatData";

const mockRedemptions: Redemption[] = [
  {
    id: "red-1",
    distributionId: "dist-1",
    studentName: "Fatima Zahra",
    reward: "Islamic Storybook",
    pointsUsed: 50,
    kind: "redeem",
    date: "2025-04-10",
    approvedBy: "Ustadha Maryam",
  },
];

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("@/tenant/features/hasanat/components/RedeemModal", () => ({
  RedeemModal: () => null,
}));

const ledgerState = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  redemptions: [] as Redemption[],
}));

vi.mock("@/tenant/features/hasanat/hooks/useHasanatApi", () => ({
  useHasanatRedemptionsState: () => ({
    redemptions: ledgerState.redemptions,
    isLoading: ledgerState.isLoading,
    isError: ledgerState.isError,
    refetch: vi.fn(),
  }),
  useHasanatMutations: () => ({
    redeemCard: { mutateAsync: vi.fn() },
  }),
}));

describe("RedemptionTracker", () => {
  const baseProps = {
    distributions: [] as Distribution[],
  };

  beforeEach(() => {
    ledgerState.isLoading = false;
    ledgerState.isError = false;
    ledgerState.redemptions = mockRedemptions;
  });

  it("renders mobile card with student name, reward, and points", () => {
    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="cards" />);

    expect(html).toContain("Fatima Zahra");
    expect(html).toContain("Islamic Storybook");
    expect(html).toContain("hasanat.form.pointsShort");
    expect(html).toContain("Ustadha Maryam");
  });

  it("renders metadata tiles for reward, date, and approver", () => {
    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="cards" />);

    expect(html).toContain("hasanat.columns.redemption.reward");
    expect(html).toContain("hasanat.columns.redemption.date");
    expect(html).toContain("hasanat.columns.redemption.approvedBy");
  });

  it("renders desktop table when viewMode is table", () => {
    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="table" />);

    expect(html).toContain("Fatima Zahra");
    expect(html).toContain("Islamic Storybook");
    expect(html).toContain("Ustadha Maryam");
  });

  it("shows a loading state instead of a fake empty ledger", () => {
    ledgerState.isLoading = true;
    ledgerState.redemptions = [];

    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="table" />);

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("common.loading");
    expect(html).not.toContain("hasanat.empty.redemptions");
  });

  it("shows a retry affordance when the ledger request failed", () => {
    ledgerState.isError = true;
    ledgerState.redemptions = [];

    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="table" />);

    expect(html).toContain("hasanat.redemptionsLoadFailed");
    expect(html).toContain("common.retry");
    expect(html).not.toContain("hasanat.empty.redemptions");
  });

  it("shows the empty state only once the ledger is settled and empty", () => {
    ledgerState.redemptions = [];

    const html = renderToStaticMarkup(<RedemptionTracker {...baseProps} viewMode="table" />);

    expect(html).toContain("hasanat.empty.redemptions");
  });
});
