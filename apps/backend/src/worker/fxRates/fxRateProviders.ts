import { isIsoCurrencyCode, isValidExchangeRate } from "@mms/shared";

/** One day's fixing from a provider: units of each quote currency per one base unit. */
export interface FxRateSnapshot {
  provider: string;
  baseCurrency: string;
  rateDate: string;
  rates: ReadonlyMap<string, string>;
}

export interface FxRateProvider {
  readonly id: string;
  fetchLatest(signal: AbortSignal): Promise<FxRateSnapshot>;
}

const FETCH_TIMEOUT_MS = 15_000;

/** Floats from JSON feeds → a plain decimal string within the 10-decimal rate scale. */
export function rateNumberToString(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const text = value.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  return isValidExchangeRate(text) ? text : null;
}

function keepValid(entries: Iterable<[string, string | null]>): Map<string, string> {
  const rates = new Map<string, string>();
  for (const [code, rate] of entries) {
    if (rate && isIsoCurrencyCode(code)) rates.set(code, rate);
  }
  return rates;
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
    headers: { accept: "application/xml, application/json" },
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.text();
}

/** Parse the ECB daily reference XML (EUR base, ~30 currencies, no PKR). */
export function parseEcbDailyXml(xml: string): FxRateSnapshot {
  const date = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  if (!date) throw new Error("ECB feed has no fixing date");
  const pairs = [...xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)];
  const rates = keepValid(pairs.map(([, code, rate]) => [code, isValidExchangeRate(rate) ? rate : null]));
  return { provider: "ecb", baseCurrency: "EUR", rateDate: date, rates };
}

/** Parse open.er-api.com `/v6/latest/<BASE>` JSON (keyless; covers PKR). */
export function parseErApiJson(body: unknown): FxRateSnapshot {
  if (typeof body !== "object" || body === null) throw new Error("ER-API feed is not an object");
  const record = body as Record<string, unknown>;
  const base = record.base_code;
  const updated = record.time_last_update_unix;
  const rates = record.rates;
  if (typeof base !== "string" || typeof updated !== "number" || typeof rates !== "object" || !rates) {
    throw new Error("ER-API feed is missing base_code, time_last_update_unix or rates");
  }
  return {
    provider: "erapi",
    baseCurrency: base,
    rateDate: new Date(updated * 1000).toISOString().slice(0, 10),
    rates: keepValid(
      Object.entries(rates).map(([code, value]) => [
        code,
        typeof value === "number" ? rateNumberToString(value) : null,
      ]),
    ),
  };
}

const PROVIDERS: Record<string, FxRateProvider> = {
  ecb: {
    id: "ecb",
    fetchLatest: async (signal) =>
      parseEcbDailyXml(
        await fetchText("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", signal),
      ),
  },
  erapi: {
    id: "erapi",
    fetchLatest: async (signal) =>
      parseErApiJson(JSON.parse(await fetchText("https://open.er-api.com/v6/latest/USD", signal))),
  },
};

/** Providers named in `FX_RATE_FEED_PROVIDERS`; unknown names are ignored. */
export function resolveFxRateProviders(ids: readonly string[]): FxRateProvider[] {
  return ids.flatMap((id) => (PROVIDERS[id] ? [PROVIDERS[id]] : []));
}
