import { createNodeConfig } from "./node.mjs";

/**
 * Lint the shared config package itself. Its rules are the SSOT every package
 * consumes, so they must pass the same preset they export (including the
 * tooling→tooling boundary). The `eslint` devDependency lives in this package.
 */
export default createNodeConfig({
  files: ["*.mjs"],
  ignores: ["node_modules/**"],
});
