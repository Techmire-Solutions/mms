import { registerHasanatJobRunners } from "./jobs/registerHasanatJobRunners.js";

/**
 * Registers the hasanat background job runners. Called from the app composition
 * root after `configureHasanatPorts`.
 */
export function createHasanatService(): { registerJobRunners: () => void } {
  return { registerJobRunners: registerHasanatJobRunners };
}
