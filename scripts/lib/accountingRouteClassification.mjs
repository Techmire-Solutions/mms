/**
 * Accounting route classification shared by the route-security ratchet and its
 * unit test, so the matrix can be regenerated and verified from one definition.
 *
 * Defaults mirror the backend module gate: a GET is `read`, any other method is
 * `write`. The overrides below mirror
 * `apps/backend/src/lib/moduleRouteActionRulesFinance.ts` plus the setup-write
 * routes (settings.global.write) and the read-shaped POSTs (previews, reports).
 */

export const MANAGE_PATTERNS = Object.freeze([
  /^\/api\/accounting\/posting-periods\/:id\/(close|reopen)$/,
  /^\/api\/accounting\/fiscal-years\/:id\/close$/,
  /^\/api\/accounting\/entries\/:id\/reverse$/,
  /^\/api\/accounting\/(ias29-restatements|fx-revaluations)$/,
  /^\/api\/accounting\/opening-balances\/:fiscalYearId\/post$/,
  /^\/api\/accounting\/voucher-numbering$/,
]);

export const SETUP_WRITE_PATTERNS = Object.freeze([
  /^\/api\/accounting\/currency-settings$/,
  /^\/api\/accounting\/currency-exchangeability$/,
  /^\/api\/accounting\/hyperinflation-settings$/,
  /^\/api\/accounting\/field-config$/,
  /^\/api\/accounting\/preferences$/,
]);

export const DELETE_PATTERNS = Object.freeze([
  /^\/api\/accounting\/(entries|accounts)\/:id$/,
  /^\/api\/accounting\/(entries|accounts)\/(:id\/restore|bulk-(delete|restore))$/,
]);

export const READ_POST_PATTERNS = Object.freeze([
  /^\/api\/accounting\/(fx-revaluations|ias29-restatements)\/preview$/,
  /^\/api\/accounting\/hedges\/:id\/valuations\/preview$/,
  /^\/api\/accounting\/reports\/(pdf|ledger\/export)$/,
]);

export const ACCOUNTING_ROUTE_ACTIONS = Object.freeze([
  "read",
  "write",
  "delete",
  "manage",
  "setupWrite",
]);

/** Roles that must be denied for each action (the module gate rejects before handlers). */
export const DENIED_ROLES_BY_ACTION = Object.freeze({
  read: ["guardian"],
  write: ["auditor", "guardian"],
  delete: ["auditor", "guardian"],
  manage: ["accountant", "auditor", "guardian"],
  setupWrite: ["accountant", "auditor", "guardian"],
});

const matches = (patterns, routePath) => patterns.some((pattern) => pattern.test(routePath));

/** Classifies one contract route into the action its module gate enforces. */
export function classifyAccountingRoute({ method, path: routePath }) {
  if (method === "GET") return "read";
  if (matches(MANAGE_PATTERNS, routePath)) return "manage";
  if (matches(SETUP_WRITE_PATTERNS, routePath)) return "setupWrite";
  if (matches(DELETE_PATTERNS, routePath)) return "delete";
  if (matches(READ_POST_PATTERNS, routePath)) return "read";
  return "write";
}

/** Converts an OpenAPI-ish contract path into a regex that matches injected URLs. */
export function routeMatcher(routePath) {
  const pattern = routePath
    .split("/")
    .map((segment) =>
      segment.startsWith(":") ? "[^/?`\"']+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${pattern}(?:[?#]|$)`);
}
