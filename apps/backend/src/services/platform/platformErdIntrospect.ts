import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import type { ErdColumn, ErdRelationship, ErdTable } from "@mms/shared";

export interface IntrospectedTableResult {
  table: ErdTable;
  relationships: ErdRelationship[];
}

export function introspectPgTable(table: PgTable): IntrospectedTableResult {
  const cfg = getTableConfig(table);

  const pkNames = new Set<string>();
  for (const pk of cfg.primaryKeys) {
    for (const c of pk.columns) pkNames.add(c.name);
  }

  const fkNames = new Set<string>();
  const relationships: ErdRelationship[] = [];

  for (const fk of cfg.foreignKeys) {
    const ref = fk.reference();
    for (const c of ref.columns) fkNames.add(c.name);

    const fromColumn = ref.columns[0]?.name || "";
    const foreignTableCfg = getTableConfig(ref.foreignTable);
    const toTable = foreignTableCfg.name;
    const toColumn = ref.foreignColumns[0]?.name || "";

    const isOneToOne = ref.columns.every((c) => c.primary || pkNames.has(c.name));

    relationships.push({
      fromTable: cfg.name,
      fromColumn,
      toTable,
      toColumn,
      cardinality: isOneToOne ? "1:1" : "N:1",
      onDelete: fk.onDelete === "cascade" || fk.onDelete === "set null" ? fk.onDelete : undefined,
    });
  }

  const uniqueNames = new Set<string>();
  for (const u of cfg.uniqueConstraints) {
    for (const c of u.columns) uniqueNames.add(c.name);
  }
  for (const idx of cfg.indexes) {
    if (idx.config.unique) {
      for (const col of idx.config.columns) {
        if (col && "name" in col && typeof col.name === "string") {
          uniqueNames.add(col.name);
        }
      }
    }
  }

  const columns: ErdColumn[] = cfg.columns.map((c) => {
    let kind: ErdColumn["kind"] = "column";
    if (c.primary || pkNames.has(c.name)) {
      kind = "pk";
    } else if (fkNames.has(c.name)) {
      kind = "fk";
    } else if (c.isUnique || uniqueNames.has(c.name)) {
      kind = "unique";
    }

    return {
      name: c.name,
      type: c.getSQLType(),
      kind,
    };
  });

  return {
    table: {
      name: cfg.name,
      columns,
    },
    relationships,
  };
}
