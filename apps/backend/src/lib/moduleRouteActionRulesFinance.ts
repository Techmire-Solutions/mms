import type { ModuleRouteActionRule } from "./moduleRouteActionRules.js";

/**
 * Finance/Accounting actions that differ from the HTTP-method default.
 *
 * Both modules previously resolved every non-GET write to `write`, so the module
 * gate could not distinguish recording a payment from waiving it, or posting a
 * voucher from closing the period. These rules map the affected routes to the
 * `delete` and `manage` capabilities (see the module manifests).
 */
export const FINANCE_ACCOUNTING_MODULE_ROUTE_ACTION_RULES: readonly ModuleRouteActionRule[] = [
  // ── Finance: archive/restore is a delete capability; waivers and pricing are
  // controller-level (`manage`). Left to the method default, both collapsed to
  // `finance.write`, so a cashier who records payments could archive invoices and
  // issue credit notes (money already recognised in the ledger).
  {
    methods: ["DELETE"],
    pattern: /^\/api\/finance\/(invoices|payments)\/:id$/,
    action: "delete",
    onlyModules: ["finance"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/finance\/(invoices|payments)\/(:id\/restore|bulk-(delete|restore))$/,
    action: "delete",
    onlyModules: ["finance"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/finance\/invoices\/(:id\/cancel|bulk-status)$/,
    action: "manage",
    onlyModules: ["finance"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/finance\/credit-notes$/,
    action: "manage",
    onlyModules: ["finance"],
  },
  {
    methods: ["PUT", "DELETE"],
    pattern: /^\/api\/finance\/fee-structures(\/:id)?$/,
    action: "manage",
    onlyModules: ["finance"],
  },
  // ── Accounting: archiving ledger records is `delete`; closing a period/year,
  // reopening one, and changing voucher numbering are controller authority
  // (`manage`) even though they are ordinary POST/PUT calls.
  {
    methods: ["DELETE"],
    pattern: /^\/api\/accounting\/(entries|accounts)\/:id$/,
    action: "delete",
    onlyModules: ["accounting"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/accounting\/(entries|accounts)\/(:id\/restore|bulk-(delete|restore))$/,
    action: "delete",
    onlyModules: ["accounting"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/accounting\/posting-periods\/:id\/(close|reopen)$/,
    action: "manage",
    onlyModules: ["accounting"],
  },
  {
    methods: ["POST"],
    pattern: /^\/api\/accounting\/fiscal-years\/:id\/close$/,
    action: "manage",
    onlyModules: ["accounting"],
  },
  {
    methods: ["PUT"],
    pattern: /^\/api\/accounting\/voucher-numbering$/,
    action: "manage",
    onlyModules: ["accounting"],
  },
];
