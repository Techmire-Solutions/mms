/**
 * Minimal Prometheus metrics registry — no external dependency.
 *
 * The app already had `/health` (pool gauges + Redis state) and pino logs, plus
 * in-house spans, but nothing an alerting system could scrape or graph over
 * time. This adds the standard operational signals in the Prometheus text
 * exposition format.
 *
 * Deliberately hand-rolled: the surface needed here is small (counters, gauges,
 * fixed-bucket histograms), and keeping it in-tree avoids another runtime
 * dependency in a service that already has a reviewed `overrides` list.
 *
 * CARDINALITY IS THE DESIGN CONSTRAINT. Every label value must come from a
 * bounded set. In particular the HTTP metrics label on the ROUTE PATTERN
 * (`/api/users/:id`), never the raw URL — using the raw path would mint a new
 * time series per id and blow up memory in the scrape backend.
 */

type Labels = Record<string, string | number>;

const PROMETHEUS_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8";

/** Escapes a label value per the Prometheus exposition format. */
function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}

/** Renders `{a="1",b="2"}` with labels sorted for stable output. */
function renderLabels(labels: Labels | undefined, extra?: Labels): string {
  const merged: Labels = { ...(labels ?? {}), ...(extra ?? {}) };
  const keys = Object.keys(merged).sort();
  if (keys.length === 0) return "";
  const body = keys.map((key) => `${key}="${escapeLabelValue(String(merged[key]))}"`).join(",");
  return `{${body}}`;
}

interface CounterSeries {
  labels: Labels;
  value: number;
}

interface GaugeDefinition {
  help: string;
  collect: () => Array<{ labels?: Labels; value: number }>;
}

interface HistogramDefinition {
  help: string;
  buckets: number[];
  series: Map<string, { labels: Labels; counts: number[]; sum: number; count: number }>;
}

export class MetricsRegistry {
  private readonly counters = new Map<
    string,
    { help: string; series: Map<string, CounterSeries> }
  >();

  private readonly gauges = new Map<string, GaugeDefinition>();

  private readonly histograms = new Map<string, HistogramDefinition>();

  /** Registers (or returns) a counter family. Idempotent across hot reloads. */
  counter(name: string, help: string): this {
    if (!this.counters.has(name)) this.counters.set(name, { help, series: new Map() });
    return this;
  }

  increment(name: string, labels?: Labels, by = 1): void {
    const family = this.counters.get(name);
    if (!family) return;
    const key = renderLabels(labels);
    const existing = family.series.get(key);
    if (existing) existing.value += by;
    else family.series.set(key, { labels: labels ?? {}, value: by });
  }

  /**
   * Registers a gauge whose value is computed at scrape time (`collect`).
   * Pull-based so the value is always current and no timers are needed.
   */
  gauge(name: string, help: string, collect: GaugeDefinition["collect"]): this {
    this.gauges.set(name, { help, collect });
    return this;
  }

  histogram(name: string, help: string, buckets: number[]): this {
    const sorted = [...buckets].sort((a, b) => a - b);
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { help, buckets: sorted, series: new Map() });
    }
    return this;
  }

  observe(name: string, value: number, labels?: Labels): void {
    const family = this.histograms.get(name);
    if (!family) return;
    const key = renderLabels(labels);
    let series = family.series.get(key);
    if (!series) {
      series = {
        labels: labels ?? {},
        counts: new Array(family.buckets.length).fill(0),
        sum: 0,
        count: 0,
      };
      family.series.set(key, series);
    }
    series.sum += value;
    series.count += 1;
    for (let i = 0; i < family.buckets.length; i += 1) {
      if (value <= family.buckets[i]!) series.counts[i] += 1;
    }
  }

  /** Renders the whole registry in Prometheus text exposition format. */
  render(): { contentType: string; body: string } {
    const lines: string[] = [];

    for (const name of [...this.counters.keys()].sort()) {
      const family = this.counters.get(name)!;
      lines.push(`# HELP ${name} ${family.help}`);
      lines.push(`# TYPE ${name} counter`);
      for (const key of [...family.series.keys()].sort()) {
        const series = family.series.get(key)!;
        lines.push(`${name}${renderLabels(series.labels)} ${series.value}`);
      }
    }

    for (const name of [...this.gauges.keys()].sort()) {
      const gauge = this.gauges.get(name)!;
      lines.push(`# HELP ${name} ${gauge.help}`);
      lines.push(`# TYPE ${name} gauge`);
      let samples: Array<{ labels?: Labels; value: number }>;
      try {
        samples = gauge.collect();
      } catch {
        // A failing collector must never break the whole scrape.
        samples = [];
      }
      for (const sample of samples) {
        lines.push(`${name}${renderLabels(sample.labels)} ${sample.value}`);
      }
    }

    for (const name of [...this.histograms.keys()].sort()) {
      const histogram = this.histograms.get(name)!;
      lines.push(`# HELP ${name} ${histogram.help}`);
      lines.push(`# TYPE ${name} histogram`);
      for (const key of [...histogram.series.keys()].sort()) {
        const series = histogram.series.get(key)!;
        for (let i = 0; i < histogram.buckets.length; i += 1) {
          lines.push(
            `${name}_bucket${renderLabels(series.labels, { le: histogram.buckets[i]! })} ${series.counts[i]}`,
          );
        }
        lines.push(`${name}_bucket${renderLabels(series.labels, { le: "+Inf" })} ${series.count}`);
        lines.push(`${name}_sum${renderLabels(series.labels)} ${series.sum}`);
        lines.push(`${name}_count${renderLabels(series.labels)} ${series.count}`);
      }
    }

    return { contentType: PROMETHEUS_CONTENT_TYPE, body: `${lines.join("\n")}\n` };
  }

  /** Test helper. */
  reset(): void {
    for (const family of this.counters.values()) family.series.clear();
    for (const histogram of this.histograms.values()) histogram.series.clear();
  }
}

/** Shared application registry. */
export const metrics = new MetricsRegistry();

/** HTTP request counters, labelled by route pattern (bounded cardinality). */
export const HTTP_REQUESTS_TOTAL = "mms_http_requests_total";
export const HTTP_REQUEST_DURATION = "mms_http_request_duration_seconds";
export const HTTP_REQUESTS_IN_FLIGHT = "mms_http_requests_in_flight";

/**
 * Latency buckets in seconds. Weighted towards the sub-second range because a
 * tenant request that takes over a second is already exceptional for this app.
 */
export const HTTP_DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/** Registers the metric families this service always exposes. */
export function registerDefaultMetrics(): void {
  metrics
    .counter(HTTP_REQUESTS_TOTAL, "Total HTTP requests handled, by route pattern and status class.")
    .histogram(
      HTTP_REQUEST_DURATION,
      "HTTP request duration in seconds, by route pattern.",
      HTTP_DURATION_BUCKETS,
    );
}
