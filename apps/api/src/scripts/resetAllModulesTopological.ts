/**
 * Topological delete ordering and row count queries for module reset.
 */
import type { Pool } from "pg";
import { PROTECTED_TABLES, quoteIdent } from "./resetAllModulesTables.js";

interface ColumnRow {
  table_name: string;
  column_name: string;
}

interface FkRow {
  table_name: string;
  foreign_table_name: string;
}

/** Compute topological delete order for all non-protected tenant-scoped tables */
export async function computeTopologicalDeleteOrder(
  pool: Pool,
): Promise<Array<{ table: string; column: string }>> {
  const colRes = await pool.query<ColumnRow>(`
    SELECT DISTINCT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name IN ('workspace_subdomain', 'tenant_id')
    ORDER BY table_name
  `);

  const scopedTables = new Map<string, string>();
  for (const r of colRes.rows) {
    if (!PROTECTED_TABLES.has(r.table_name)) {
      scopedTables.set(r.table_name, r.column_name);
    }
  }

  const moduleTables = Array.from(scopedTables.keys());

  const fkRes = await pool.query<FkRow>(`
    SELECT
      tc.table_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
  `);

  const childToParents = new Map<string, Set<string>>();
  for (const t of moduleTables) {
    childToParents.set(t, new Set());
  }

  for (const r of fkRes.rows) {
    if (
      r.table_name !== r.foreign_table_name &&
      scopedTables.has(r.table_name) &&
      scopedTables.has(r.foreign_table_name)
    ) {
      childToParents.get(r.table_name)?.add(r.foreign_table_name);
    }
  }

  const parentToChildren = new Map<string, Set<string>>();
  for (const t of moduleTables) {
    parentToChildren.set(t, new Set());
  }
  for (const [child, parents] of childToParents.entries()) {
    for (const parent of parents) {
      parentToChildren.get(parent)?.add(child);
    }
  }

  const deleteOrder: Array<{ table: string; column: string }> = [];
  const remaining = new Set(moduleTables);

  while (remaining.size > 0) {
    const ready = Array.from(remaining).filter((t) => {
      const children = parentToChildren.get(t) || new Set();
      for (const c of children) {
        if (remaining.has(c)) return false;
      }
      return true;
    });

    if (ready.length === 0) {
      const fallback = remaining.values().next().value;
      if (!fallback) break;
      deleteOrder.push({
        table: fallback,
        column: scopedTables.get(fallback) ?? "workspace_subdomain",
      });
      remaining.delete(fallback);
    } else {
      for (const t of ready) {
        deleteOrder.push({ table: t, column: scopedTables.get(t) ?? "workspace_subdomain" });
        remaining.delete(t);
      }
    }
  }

  return deleteOrder;
}

export async function countTenantTableRows(
  pool: Pool,
  table: string,
  column: string,
  tenant: string,
): Promise<number> {
  const query = `SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)} WHERE ${quoteIdent(column)} = $1`;
  const res = await pool.query<{ count: number }>(query, [tenant]);
  return Number(res.rows[0]?.count ?? 0);
}
