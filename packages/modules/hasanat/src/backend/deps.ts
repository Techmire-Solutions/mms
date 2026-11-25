import type { HasanatPorts } from "./ports.js";

let ports: HasanatPorts | null = null;

/** Composition-root binding; called once from `apps/api` before routes/jobs load. */
export function configureHasanatPorts(next: HasanatPorts): void {
  ports = next;
}

function requirePorts(): HasanatPorts {
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
