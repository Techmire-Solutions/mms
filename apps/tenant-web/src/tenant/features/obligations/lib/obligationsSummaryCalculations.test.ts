import { describe, expect, it } from "vitest";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  buildMonthlyTrend,
  buildRepSummary,
  buildTypeBreakdown,
  buildWakalaSummary,
  sumAmounts,
} from "./obligationsSummaryCalculations";

const t = ((key: string) => key) as TranslationFunction;

const obligationTypes = [{ id: "ot-1", name: "Khums" }] as never;
const reps = [{ id: "rep-1", name: "Mawlana Ali", mujtahid_id: "muj-1" }] as never;
const mujtahids = [{ id: "muj-1", name: "Ayatollah Sistani" }] as never;
const wakalaTypes = [
  { id: "wak-1", mujtahid_representative_id: "rep-1", obligation_type_id: "ot-1" },
] as never;
const distributions = [
  { id: "d-1", wakala_type_id: "wak-1", percentage: 50, type: "Liability" },
  { id: "d-2", wakala_type_id: "wak-1", percentage: 50, type: "Expense" },
] as never;

const collections = [
  {
    id: "col-1",
    mujtahid_representative_id: "rep-1",
    obligation_type_id: "ot-1",
    amount: 50000.1,
    received_date: "2026-03-10",
  },
  {
    id: "col-2",
    mujtahid_representative_id: "rep-none",
    obligation_type_id: "ot-missing",
    amount: 50000.2,
    received_date: undefined,
  },
] as never;

describe("obligationsSummaryCalculations", () => {
  it("sums floats via integer cents accurately", () => {
    expect(sumAmounts([50000.1, 50000.2, Number.NaN])).toBe(100000.3);
  });

  it("builds wakala, rep, type breakdown, and monthly trend summaries", () => {
    const wakala = buildWakalaSummary(
      collections,
      reps,
      mujtahids,
      wakalaTypes,
      obligationTypes,
      distributions,
      t,
    );
    expect(wakala).toHaveLength(2);
    expect(wakala[0].total).toBe(50000.2);

    const repSummary = buildRepSummary(
      collections,
      reps,
      mujtahids,
      wakalaTypes,
      obligationTypes,
      distributions,
      t,
    );
    expect(repSummary).toHaveLength(2);
    const matchedRep = repSummary.find((r) => r.key === "rep-1")!;
    expect(matchedRep.due).toBe(25000.05);
    expect(matchedRep.byType.Khums).toBe(50000.1);

    const breakdown = buildTypeBreakdown(collections, obligationTypes, t);
    expect(breakdown.map((b) => b.name)).toContain("Khums");
    expect(breakdown.map((b) => b.name)).toContain("obligations.summary.other");

    const trend = buildMonthlyTrend(collections, t);
    expect(trend).toHaveLength(2);
    expect(trend.map((entry) => entry.month)).toContain("2026-03");
    expect(trend.map((entry) => entry.month)).toContain("obligations.summary.unknown");
  });
});
