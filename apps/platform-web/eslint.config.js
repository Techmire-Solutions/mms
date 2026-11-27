import { createReactConfig } from "@mms/eslint-config";

// Transitional: `apps/platform-web` carries the shared frontend shell while the
// tenant/platform audience split is finalized, so it uses `appKind: "app"`.
// Finishing it requires re-homing translation/prefetch/entity-registry/db off
// tenant modules (see .cursor/rules/mms-migration-status.mdc).
export default createReactConfig({
  appKind: "app",
  files: ["src/**/*.{ts,tsx}"],
});
