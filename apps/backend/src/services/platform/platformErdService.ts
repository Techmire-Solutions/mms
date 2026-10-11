import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import type { ErdDomain, ErdRelationship, ErdTable, PlatformErdResponse } from "@mms/shared";
import { DOMAIN_REGISTRY } from "./platformErdDomains.js";
import { introspectPgTable } from "./platformErdIntrospect.js";

let cachedResponse: PlatformErdResponse | null = null;

/**
 * Dynamically introspects all active Drizzle tables across domain modules.
 * Automatically generates the ErdDomain catalog, columns, and foreign-key edges.
 */
export function getIntrospectedErdDomains(): PlatformErdResponse {
  if (cachedResponse) {
    return cachedResponse;
  }

  const allTablesByName = new Map<string, ErdTable>();
  const allRelationshipsByFromTable = new Map<string, ErdRelationship[]>();

  for (const config of DOMAIN_REGISTRY) {
    for (const mod of config.modules) {
      for (const value of Object.values(mod)) {
        if (is(value, PgTable)) {
          const { table, relationships } = introspectPgTable(value as PgTable);
          if (!allTablesByName.has(table.name)) {
            allTablesByName.set(table.name, table);
          }
          const existingRels = allRelationshipsByFromTable.get(table.name) || [];
          allRelationshipsByFromTable.set(table.name, [...existingRels, ...relationships]);
        }
      }
    }
  }

  const domains: ErdDomain[] = DOMAIN_REGISTRY.map((config) => {
    const domainTables = new Map<string, ErdTable>();
    const domainRelationships: ErdRelationship[] = [];

    for (const mod of config.modules) {
      for (const value of Object.values(mod)) {
        if (is(value, PgTable)) {
          const cfg = getTableConfig(value as PgTable);
          const table = allTablesByName.get(cfg.name);
          if (table && !domainTables.has(table.name)) {
            domainTables.set(table.name, table);
          }
        }
      }
    }

    for (const tableName of domainTables.keys()) {
      const rels = allRelationshipsByFromTable.get(tableName) || [];
      for (const rel of rels) {
        if (rel.fromColumn === "workspace_subdomain" && config.id !== "platform") {
          continue;
        }

        if (allTablesByName.has(rel.toTable) && !domainTables.has(rel.toTable)) {
          const targetTable = allTablesByName.get(rel.toTable)!;
          domainTables.set(targetTable.name, targetTable);
        }

        if (domainTables.has(rel.fromTable) && domainTables.has(rel.toTable)) {
          domainRelationships.push(rel);
        }
      }
    }

    const sortedTables = Array.from(domainTables.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return {
      id: config.id,
      labelKey: config.labelKey,
      tables: sortedTables,
      relationships: domainRelationships,
    };
  });

  cachedResponse = {
    success: true,
    domains,
    totalTables: allTablesByName.size,
    generatedAt: new Date().toISOString(),
  };

  return cachedResponse;
}

/** Clear cache during testing or hot reload. */
export function resetIntrospectedErdCache(): void {
  cachedResponse = null;
}
