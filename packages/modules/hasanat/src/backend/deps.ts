import type { HasanatPorts } from "./ports.js";

const PORTS_KEY = Symbol.for("@mms/mod-hasanat/ports");
type GlobalWithPorts = typeof globalThis & { [PORTS_KEY]?: HasanatPorts | null };

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureHasanatPorts(next: HasanatPorts): void {
  (globalThis as GlobalWithPorts)[PORTS_KEY] = next;
}

function requirePorts(): HasanatPorts {
  const ports = (globalThis as GlobalWithPorts)[PORTS_KEY];
  if (!ports) throw new Error("Hasanat ports are not configured (call configureHasanatPorts)");
  return ports;
}

export function enqueueBackgroundJob(...args: Parameters<HasanatPorts["enqueueBackgroundJob"]>) {
  return requirePorts().enqueueBackgroundJob(...args);
}

export function registerModuleCsvExportJobRunner(
  options: Parameters<HasanatPorts["registerModuleCsvExportJobRunner"]>[0],
): void {
  requirePorts().registerModuleCsvExportJobRunner(options);
}
