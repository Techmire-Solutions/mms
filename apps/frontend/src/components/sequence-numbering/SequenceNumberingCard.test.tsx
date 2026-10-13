import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SequenceNumberingCard } from "./SequenceNumberingCard";
import type { SequenceNumberingConfig } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        "common.sequenceNumbering.autoGenerate": `Auto-generate ${params?.entity ?? ""}`,
        "common.sequenceNumbering.preview": "Live Preview",
        "common.sequenceNumbering.template": "ID Format Template",
        "common.sequenceNumbering.prefix": "Prefix",
        "common.sequenceNumbering.prefixHint": "Default prefix used across IDs",
        "common.sequenceNumbering.prefixPlaceholder": `e.g. ${params?.example ?? "ID"}`,
        "common.sequenceNumbering.yearFormat": "Year Format",
        "common.sequenceNumbering.yearFormatHint": "Four-digit (YYYY), two-digit (YY), or omit",
        "common.sequenceNumbering.yearFormatYYYY": `YYYY (e.g. ${params?.year ?? ""})`,
        "common.sequenceNumbering.yearFormatYY": `YY (e.g. ${params?.year ?? ""})`,
        "common.sequenceNumbering.yearFormatNone": "None (omit year)",
        "common.sequenceNumbering.digits": "Sequence Digits",
        "common.sequenceNumbering.digitsHint": 'e.g. 4 produces "0001"',
        "common.sequenceNumbering.digitsRangeError": "Enter a value from 2 to 8",
        "common.sequenceNumbering.delimiter": "Delimiter",
        "common.sequenceNumbering.delimiterHint": "Optional separator",
        "common.sequenceNumbering.delimiterPlaceholder": "e.g. - or leave empty",
        "common.sequenceNumbering.delimiterNone": "None",
        "common.sequenceNumbering.delimiterHyphen": "Hyphen (-)",
        "common.sequenceNumbering.delimiterSlash": "Slash (/)",
        "common.sequenceNumbering.delimiterDot": "Dot (.)",
        "common.sequenceNumbering.startLabel": "Starting Sequence",
        "common.sequenceNumbering.startHint": "Initial sequence number",
        "common.sequenceNumbering.startMinError": "Starting sequence must be at least 1",
        "common.sequenceNumbering.lastIssued": "Last issued",
        "common.sequenceNumbering.counter": "Current counter",
        "common.sequenceNumbering.rolloverYear": "Rollover year",
        "common.sequenceNumbering.restartAnnually": "Restart sequence annually",
        "common.sequenceNumbering.restartAnnuallyDesc": `Reset ${params?.entity ?? ""} sequence annually`,
        "common.sequenceNumbering.restartFiscal": "Restart sequence every fiscal year",
        "common.sequenceNumbering.restartFiscalDesc": `Reset ${params?.entity ?? ""} sequence each fiscal year`,
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("SequenceNumberingCard Component", () => {
  const mockConfig: SequenceNumberingConfig = {
    autoGenerate: true,
    prefix: "FAC",
    yearFormat: "YY",
    sequenceDigits: 3,
    delimiter: "",
    startingSequence: 1,
    rolloverPolicy: "annual_calendar",
    currentSequence: 0,
    lastRolloverYear: 2026,
  };

  it("renders live preview formula and formatted sample badge", () => {
    const html = renderToStaticMarkup(
      <SequenceNumberingCard
        title="Employee ID Configuration"
        entityLabel="Employee ID"
        config={mockConfig}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain("Employee ID Configuration");
    expect(html).toContain("Auto-generate Employee ID");
    expect(html).toContain("{PREFIX}{YY}{SEQ}");
    expect(html).toContain("Live Preview");
    expect(html).toContain("Last issued");
    expect(html).toContain("FAC");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-label="None"');
    expect(html).toContain("∅");
    expect(html).not.toContain('name="sequence-delimiter"');
    expect(html).toContain('id="sequence-delimiter"');
    expect(html).toContain("Current counter");
    expect(html).toContain("<dl");
  });

  it("renders yearless configuration when enabled", () => {
    const yearlessConfig: SequenceNumberingConfig = {
      ...mockConfig,
      prefix: "JE",
      yearFormat: "NONE",
      delimiter: "-",
      sequenceDigits: 4,
    };

    const html = renderToStaticMarkup(
      <SequenceNumberingCard
        title="Journal Voucher Numbering"
        entityLabel="Journal Voucher"
        config={yearlessConfig}
        onChange={vi.fn()}
        allowYearless={true}
      />,
    );

    expect(html).toContain("Journal Voucher Numbering");
    expect(html).toContain("{PREFIX}-{SEQ}");
    expect(html).toContain("JE-0001");
    expect(html).toContain("None (omit year)");
    expect(html).toContain('aria-label="Hyphen (-)"');
    expect(html).toContain('aria-pressed="true"');
  });
});
