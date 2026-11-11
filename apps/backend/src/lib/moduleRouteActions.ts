import type { ModuleAction } from "@mms/shared";
import { MODULE_ROUTE_ACTION_RULES } from "./moduleRouteActionRules.js";

export type { ModuleRouteActionRule } from "./moduleRouteActionRules.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Single registry of module routes whose required action differs from the HTTP
 * method default (GET/HEAD/OPTIONS → read, everything else → write). Matched
 * against the registered route URL, so it covers ts-rest contract routes that
 * cannot carry per-route Fastify config. Hand-written routes may instead set
 * `config.moduleAction`, which wins over this table.
 */
export function resolveModuleRouteAction(
  methods: string | readonly string[],
  url: string,
  moduleId: string,
  declared?: ModuleAction,
): ModuleAction {
  if (declared) return declared;
  const list = (Array.isArray(methods) ? methods : [methods]).map((m) => String(m).toUpperCase());
  const mutating = list.find((m) => !READ_METHODS.has(m));
  const method = mutating ?? list[0] ?? "GET";
  const rule = MODULE_ROUTE_ACTION_RULES.find(
    (r) =>
      r.methods.includes(method) &&
      r.pattern.test(url) &&
      (!r.onlyModules || r.onlyModules.includes(moduleId)) &&
      !(r.exceptModules ?? []).includes(moduleId),
  );
  if (rule) return rule.action;
  return mutating ? "write" : "read";
}
