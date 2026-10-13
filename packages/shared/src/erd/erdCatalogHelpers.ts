import {
  ERD_DOMAIN_IDS,
  type ErdColumn,
  type ErdDomain,
  type ErdDomainId,
  type ErdRelationship,
  type ErdTable,
} from "./erdCatalogTypes.js";

const DOMAIN_ID_SET = new Set<string>(ERD_DOMAIN_IDS);

/** True when `value` is a registered ERD domain id. */
export function isErdDomainId(value: string): value is ErdDomainId {
  return DOMAIN_ID_SET.has(value);
}

/** Tables one hop from `tableName` (inclusive), plus edges that stay inside that set. */
export function filterErdDomainByTable(domain: ErdDomain, tableName: string): ErdDomain {
  const related = new Set<string>([tableName]);
  for (const rel of domain.relationships) {
    if (rel.fromTable === tableName) related.add(rel.toTable);
    if (rel.toTable === tableName) related.add(rel.fromTable);
  }
  return {
    ...domain,
    tables: domain.tables.filter((table) => related.has(table.name)),
    relationships: domain.relationships.filter(
      (rel) => related.has(rel.fromTable) && related.has(rel.toTable),
    ),
  };
}

/** Related-table names for the domain dropdown (sorted, unique). */
export function listErdTableNames(tables: readonly ErdTable[]): string[] {
  return [...new Set(tables.map((table) => table.name))].sort((a, b) => a.localeCompare(b));
}

const MERMAID_REL: Record<ErdRelationship["cardinality"], string> = {
  "1:1": "||--||",
  "1:N": "||--o{",
  "N:1": "}o--||",
  "N:M": "}o--o{",
};

/** Sanitize a table/column token for Mermaid `erDiagram` identifiers. */
export function mermaidErdToken(value: string): string {
  const token = value.replace(/[^A-Za-z0-9_]/g, "_");
  return token.length > 0 ? token : "col";
}

function mermaidColumnLine(column: ErdColumn): string {
  const type = mermaidErdToken(column.type);
  const name = mermaidErdToken(column.name);
  if (column.kind === "pk") return `        ${type} ${name} PK`;
  if (column.kind === "fk") return `        ${type} ${name} FK`;
  if (column.kind === "unique") return `        ${type} ${name} UK`;
  return `        ${type} ${name}`;
}

/**
 * Build a Mermaid `erDiagram` for a domain (or a focused table subgraph).
 */
export function buildErdMermaid(domain: ErdDomain): string {
  const entities = domain.tables.map((table) => {
    const body = table.columns.map(mermaidColumnLine).join("\n");
    return `    ${mermaidErdToken(table.name)} {\n${body}\n    }`;
  });
  const edges = domain.relationships.map((rel) => {
    const arrow = MERMAID_REL[rel.cardinality];
    const label = mermaidErdToken(rel.fromColumn);
    return `    ${mermaidErdToken(rel.fromTable)} ${arrow} ${mermaidErdToken(rel.toTable)} : ${label}`;
  });
  return ["erDiagram", ...entities, ...edges].join("\n");
}
