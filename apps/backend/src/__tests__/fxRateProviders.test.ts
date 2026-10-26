import { describe, expect, it } from "vitest";
import {
  parseEcbDailyXml,
  parseErApiJson,
  rateNumberToString,
  resolveFxRateProviders,
} from "../worker/fxRates/fxRateProviders.js";

const ECB_XML = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope><Cube><Cube time='2026-10-23'>
  <Cube currency='USD' rate='1.0812'/>
  <Cube currency='JPY' rate='163.21'/>
  <Cube currency='XXX' rate='9'/>
</Cube></Cube></gesmes:Envelope>`;

describe("parseEcbDailyXml", () => {
  it("given the ECB daily file, should return EUR-based ISO quotes for the fixing date", () => {
    // Arrange / Act
    const snapshot = parseEcbDailyXml(ECB_XML);

    // Assert
    expect(snapshot).toMatchObject({
      provider: "ecb",
      baseCurrency: "EUR",
      rateDate: "2026-10-23",
    });
    expect([...snapshot.rates]).toEqual([
      ["USD", "1.0812"],
      ["JPY", "163.21"],
    ]);
  });

  it("given a file without a fixing date, should throw instead of guessing a date", () => {
    // Arrange / Act / Assert
    expect(() => parseEcbDailyXml("<Cube currency='USD' rate='1.08'/>")).toThrow(/fixing date/);
  });
});

describe("parseErApiJson", () => {
  it("given an ER-API payload, should convert float rates to decimal strings and keep PKR", () => {
    // Arrange
    const body = {
      base_code: "USD",
      time_last_update_unix: 1792713600,
      rates: { USD: 1, PKR: 280.123456789, BTC: 0.00001, BAD: "x" },
    };

    // Act
    const snapshot = parseErApiJson(body);

    // Assert
    expect(snapshot.rateDate).toBe("2026-10-23");
    expect(snapshot.rates.get("PKR")).toBe("280.123456789");
    expect(snapshot.rates.has("BTC")).toBe(false);
    expect(snapshot.rates.has("BAD")).toBe(false);
  });

  it("given a payload missing fields, should throw", () => {
    // Arrange / Act / Assert
    expect(() => parseErApiJson({ rates: {} })).toThrow(/base_code/);
  });
});

describe("rateNumberToString", () => {
  it("given tiny, zero or negative floats, should never emit exponent notation or invalid rates", () => {
    // Arrange / Act / Assert
    expect(rateNumberToString(1e-7)).toBe("0.0000001");
    expect(rateNumberToString(0)).toBeNull();
    expect(rateNumberToString(-1)).toBeNull();
  });
});

describe("resolveFxRateProviders", () => {
  it("given configured names, should ignore unknown providers", () => {
    // Arrange / Act
    const providers = resolveFxRateProviders(["ecb", "nope", "erapi"]);

    // Assert
    expect(providers.map((p) => p.id)).toEqual(["ecb", "erapi"]);
  });
});
