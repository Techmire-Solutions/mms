import { and, sql, type SQL } from "drizzle-orm";
import type { WidgetQuery } from "@mms/shared";
import { questions } from "../schema.js";
import { HttpDomainError } from "../../lib/httpErrors.js";

/**
 * Strict widget-field resolution for Question Bank aggregates.
 *
 * Extracted from the aggregator to keep each module under the line ceiling. Unknown fields are a
 * 400: silently substituting a column reported a wrong metric with no signal.
 */

/** Number of papers referencing a question (uses `test_questions_workspace_question_idx`). */
const USAGE_COUNT_SQL = sql<number>`(
  SELECT count(*)::int FROM test_questions tq
   WHERE tq.workspace_subdomain = ${questions.workspaceSubdomain}
     AND tq.question_id = ${questions.id}
)`;

interface DirectField {
  expr: SQL;
  kind: "enum" | "numeric";
}

/**
 * Columns a widget may reference directly. Deliberately a closed map: the previous implementation
 * fell back to `questions.type` for any unknown field, so `status`/`categoryId`/`usageCount` widgets
 * silently charted the wrong dimension.
 */
const DIRECT_FIELDS: Record<string, DirectField> = {
  type: { expr: sql`${questions.type}`, kind: "enum" },
  difficulty: { expr: sql`${questions.difficulty}`, kind: "enum" },
  questionLanguage: { expr: sql`${questions.questionLanguage}`, kind: "enum" },
  status: { expr: sql`${questions.status}`, kind: "enum" },
  marks: { expr: sql`${questions.marks}`, kind: "numeric" },
};

const SPECIAL_FIELDS = new Set(["categoryId", "usageCount"]);

function badField(field: string): never {
  throw new HttpDomainError(400, "validation_error", `Unsupported widget field "${field}"`);
}

function badOperator(operator: string): never {
  throw new HttpDomainError(400, "validation_error", `Unsupported filter operator "${operator}"`);
}

function resolveDirectField(field: string): DirectField {
  const entry = DIRECT_FIELDS[field];
  if (!entry) badField(field);
  return entry;
}

function numericValue(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpDomainError(400, "validation_error", `Field "${field}" needs a numeric value`);
  }
  return parsed;
}

/** `categoryId` is a junction row, not a column: filter with a correlated EXISTS. */
function categoryFilterSql(value: string): SQL {
  return sql`exists (
    SELECT 1 FROM question_categories qc
     WHERE qc.workspace_subdomain = ${questions.workspaceSubdomain}
       AND qc.question_id = ${questions.id}
       AND qc.category_id = ${value}
  )`;
}

function singleFilterSql(
  field: string | undefined,
  operator: WidgetQuery["filterOperator"],
  value: string | undefined,
): SQL | null {
  const name = field?.trim();
  if (!name || value == null || value.trim() === "") return null;
  const raw = value.trim();
  const op = operator ?? "equals";

  if (SPECIAL_FIELDS.has(name)) {
    if (name === "categoryId") {
      if (op !== "equals") badOperator(op);
      return categoryFilterSql(raw);
    }
    const n = numericValue(raw, name);
    if (op === "equals") return sql`${USAGE_COUNT_SQL} = ${n}`;
    if (op === "gt") return sql`${USAGE_COUNT_SQL} > ${n}`;
    if (op === "lt") return sql`${USAGE_COUNT_SQL} < ${n}`;
    badOperator(op);
  }

  const { expr, kind } = resolveDirectField(name);
  if (kind === "numeric") {
    const n = numericValue(raw, name);
    if (op === "equals") return sql`${expr} = ${n}`;
    if (op === "gt") return sql`${expr} > ${n}`;
    if (op === "lt") return sql`${expr} < ${n}`;
    return badOperator(op);
  }

  // Enums are stored lowercase, so direct equality can use the column indexes.
  if (op === "equals") return sql`${expr} = ${raw.toLowerCase()}`;
  if (op === "contains") return sql`${expr}::text ILIKE ${`%${raw}%`}`;
  if (op === "startsWith") return sql`${expr}::text ILIKE ${`${raw}%`}`;
  return badOperator(op);
}

/** Primary filter + the multi-rule `filters[]` array, ANDed. */
function widgetFilterSql(query: WidgetQuery): SQL | null {
  const parts: SQL[] = [];
  const primary = singleFilterSql(query.filterField, query.filterOperator, query.filterValue);
  if (primary) parts.push(primary);
  for (const filter of query.filters ?? []) {
    const extra = singleFilterSql(filter.field, filter.operator, filter.value);
    if (extra) parts.push(extra);
  }
  return parts.length > 0 ? and(...parts)! : null;
}

/** Chart axis for direct (non-category) fields. */
function chartExpression(field: string | undefined): SQL<string> {
  const name = field?.trim() || "type";
  if (name === "categoryId") {
    // Handled by the junction-table chart path; never reached for a well-formed widget.
    throw new HttpDomainError(400, "validation_error", "categoryId charts use the junction query");
  }
  if (name === "usageCount") {
    throw new HttpDomainError(400, "validation_error", "usageCount cannot be a chart axis");
  }
  const { expr, kind } = resolveDirectField(name);
  if (kind !== "enum") {
    throw new HttpDomainError(400, "validation_error", `Field "${name}" cannot be a chart axis`);
  }
  return sql<string>`coalesce(nullif(trim(${expr}::text), ''), 'Unknown')`;
}

/** Numeric target for sum/avg. */
function targetExpression(field: string | undefined): SQL {
  const name = field?.trim() || "";
  if (!name) {
    throw new HttpDomainError(400, "validation_error", "sum/avg widgets need a targetField");
  }
  if (name === "usageCount") return USAGE_COUNT_SQL;
  const { expr, kind } = resolveDirectField(name);
  if (kind !== "numeric") {
    throw new HttpDomainError(400, "validation_error", `Field "${name}" is not numeric`);
  }
  return expr;
}
export { widgetFilterSql, chartExpression, targetExpression };
