import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema.js";

let _db: NodePgDatabase<typeof schema> | null = null;

interface RelationalWhereHelpers {
  isNull?: (column: unknown) => unknown;
  and?: (...conditions: unknown[]) => unknown;
  [key: string]: unknown;
}

type WhereCallback = (relation: unknown, helpers: RelationalWhereHelpers) => unknown;

interface RelationalConfigItem {
  where?: WhereCallback;
  with?: Record<string, unknown>;
  [key: string]: unknown;
}

function applySoftDeleteGuardrailsToWith(
  withOption: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(withOption)) {
    if (value === true) {
      result[key] = {
        where: (relation: unknown, helpers: RelationalWhereHelpers) =>
          relation && typeof relation === "object" && "deletedAt" in relation
            ? helpers?.isNull?.((relation as { deletedAt: unknown }).deletedAt)
            : undefined,
      };
    } else if (typeof value === "object" && value !== null) {
      const copy: RelationalConfigItem = { ...(value as Record<string, unknown>) };
      if (!copy.where) {
        copy.where = (relation: unknown, helpers: RelationalWhereHelpers) =>
          relation && typeof relation === "object" && "deletedAt" in relation
            ? helpers?.isNull?.((relation as { deletedAt: unknown }).deletedAt)
            : undefined;
      } else {
        const origWhere = copy.where;
        copy.where = (relation: unknown, helpers: RelationalWhereHelpers) => {
          const userCond = origWhere(relation, helpers);
          if (
            relation &&
            typeof relation === "object" &&
            "deletedAt" in relation &&
            typeof helpers?.isNull === "function"
          ) {
            const softDeleteCond = helpers.isNull((relation as { deletedAt: unknown }).deletedAt);
            return userCond
              ? typeof helpers.and === "function"
                ? helpers.and(userCond, softDeleteCond)
                : userCond
              : softDeleteCond;
          }
          return userCond;
        };
      }
      if (copy.with && typeof copy.with === "object") {
        copy.with = applySoftDeleteGuardrailsToWith(copy.with as Record<string, unknown>);
      }
      result[key] = copy;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function wrapDbWithRelationalGuardrails<TDb extends object>(dbInstance: TDb): TDb {
  if (!dbInstance || typeof dbInstance !== "object") return dbInstance;
  const originalQuery = Reflect.get(dbInstance, "query") as object | undefined;
  if (!originalQuery || typeof originalQuery !== "object") return dbInstance;

  const queryProxy = new Proxy(originalQuery, {
    get(target, tableKey, receiver) {
      const tableQuery = Reflect.get(target, tableKey, receiver);
      if (!tableQuery || typeof tableQuery !== "object") return tableQuery;

      return new Proxy(tableQuery, {
        get(tableTarget, methodKey, tableReceiver) {
          const origMethod = Reflect.get(tableTarget, methodKey, tableReceiver);
          if (typeof origMethod !== "function") return origMethod;
          if (methodKey !== "findFirst" && methodKey !== "findMany") return origMethod;

          return function (options?: Record<string, unknown>) {
            let effectiveOptions = options;
            if (options && options.with && typeof options.with === "object") {
              effectiveOptions = {
                ...options,
                with: applySoftDeleteGuardrailsToWith(options.with as Record<string, unknown>),
              };
            }
            return origMethod.call(tableTarget, effectiveOptions);
          };
        },
      });
    },
  });

  return new Proxy(dbInstance, {
    get(target, prop, receiver) {
      if (prop === "query") {
        return queryProxy;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export function setDb(instance: NodePgDatabase<typeof schema> | null): void {
  _db = instance ? wrapDbWithRelationalGuardrails(instance) : null;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    throw new Error("Database not initialized");
  }
  return _db;
}
