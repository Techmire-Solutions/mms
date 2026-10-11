import { and, eq, sql } from "drizzle-orm";
import { tenantUsers, contacts, students, sessions } from "./schema.js";
import { getRootDb } from "./dbConnection.js";
import {
  preparedTenantUserColumns,
  preparedContactColumns,
  preparedStudentColumns,
  preparedSessionColumns,
} from "./preparedColumns.js";

export {
  preparedTenantUserColumns,
  preparedContactColumns,
  preparedStudentColumns,
  preparedSessionColumns,
};

export type PreparedTenantUserRow = typeof tenantUsers.$inferSelect;
export type PreparedContactRow = typeof contacts.$inferSelect;
export type PreparedStudentRow = typeof students.$inferSelect;
export type PreparedSessionRow = typeof sessions.$inferSelect;

export interface PreparedLookupStatement<T> {
  execute(params: { subdomain: string; id: string }): Promise<T[]>;
}

interface SelectPrepareChain<T> {
  from(table: unknown): {
    where(clause: unknown): {
      limit(n: number): {
        prepare(name: string): PreparedLookupStatement<T>;
      };
    };
  };
}

function tryPrepareWithClient<T>(
  client: unknown,
  columns: Record<string, unknown>,
  table: unknown,
  whereClause: unknown,
  statementName: string,
): PreparedLookupStatement<T> {
  if (!client || typeof client !== "object" || !("select" in client)) {
    throw new Error("Client does not support select");
  }
  const selectFn = (client as { select: (cols: unknown) => SelectPrepareChain<T> }).select;
  if (typeof selectFn !== "function") {
    throw new Error("Client select is not a function");
  }
  const q = selectFn.call(client, columns).from(table).where(whereClause);
  const prep = q?.limit?.(1)?.prepare?.(statementName);
  if (!prep) {
    throw new Error("Client does not support prepare");
  }
  return prep;
}

let preparedTenantUserById: PreparedLookupStatement<PreparedTenantUserRow> | null = null;
let preparedContactById: PreparedLookupStatement<PreparedContactRow> | null = null;
let preparedStudentById: PreparedLookupStatement<PreparedStudentRow> | null = null;
let preparedSessionById: PreparedLookupStatement<PreparedSessionRow> | null = null;

export function resetPreparedStatements(): void {
  preparedTenantUserById = null;
  preparedContactById = null;
  preparedStudentById = null;
  preparedSessionById = null;
}

function getOrCompileStatement<TRow>(
  cached: PreparedLookupStatement<TRow> | null,
  setCache: (stmt: PreparedLookupStatement<TRow>) => void,
  client: unknown | undefined,
  columns: Record<string, unknown>,
  table: unknown,
  whereClause: unknown,
  name: string,
): PreparedLookupStatement<TRow> {
  if (client) {
    return tryPrepareWithClient<TRow>(client, columns, table, whereClause, name);
  }
  if (!cached) {
    const db = getRootDb() as unknown as { select: (c: unknown) => SelectPrepareChain<TRow> };
    const stmt = db.select(columns).from(table).where(whereClause).limit(1).prepare(name);
    setCache(stmt);
    return stmt;
  }
  return cached;
}

/** Hot read path: fetch tenant user by workspace and id with compiled PostgreSQL prepared statement. */
export function getPreparedTenantUserById(
  client?: unknown,
): PreparedLookupStatement<PreparedTenantUserRow> {
  return getOrCompileStatement(
    preparedTenantUserById,
    (s) => {
      preparedTenantUserById = s;
    },
    client,
    preparedTenantUserColumns,
    tenantUsers,
    and(
      eq(tenantUsers.workspaceSubdomain, sql.placeholder("subdomain")),
      eq(tenantUsers.id, sql.placeholder("id")),
    ),
    "prepared_find_tenant_user_by_id",
  );
}

/** Hot read path: fetch active contact by workspace and id with compiled prepared statement. */
export function getPreparedContactById(
  client?: unknown,
): PreparedLookupStatement<PreparedContactRow> {
  return getOrCompileStatement(
    preparedContactById,
    (s) => {
      preparedContactById = s;
    },
    client,
    preparedContactColumns,
    contacts,
    and(
      eq(contacts.workspaceSubdomain, sql.placeholder("subdomain")),
      eq(contacts.id, sql.placeholder("id")),
    ),
    "prepared_find_contact_by_id",
  );
}

/** Hot read path: fetch active student by workspace and id with compiled prepared statement. */
export function getPreparedStudentById(
  client?: unknown,
): PreparedLookupStatement<PreparedStudentRow> {
  return getOrCompileStatement(
    preparedStudentById,
    (s) => {
      preparedStudentById = s;
    },
    client,
    preparedStudentColumns,
    students,
    and(
      eq(students.workspaceSubdomain, sql.placeholder("subdomain")),
      eq(students.id, sql.placeholder("id")),
    ),
    "prepared_find_student_by_id",
  );
}

/** Hot read path: fetch active session by workspace and id with compiled prepared statement. */
export function getPreparedSessionById(
  client?: unknown,
): PreparedLookupStatement<PreparedSessionRow> {
  return getOrCompileStatement(
    preparedSessionById,
    (s) => {
      preparedSessionById = s;
    },
    client,
    preparedSessionColumns,
    sessions,
    and(
      eq(sessions.workspaceSubdomain, sql.placeholder("subdomain")),
      eq(sessions.id, sql.placeholder("id")),
    ),
    "prepared_find_session_by_id",
  );
}

/** Helper to execute prepared tenant user lookup with parameter binding. */
export async function executePreparedTenantUserLookup(subdomain: string, id: string) {
  const stmt = getPreparedTenantUserById();
  return stmt.execute({ subdomain, id });
}

/** Helper to execute prepared contact lookup with parameter binding. */
export async function executePreparedContactLookup(subdomain: string, id: string) {
  const stmt = getPreparedContactById();
  return stmt.execute({ subdomain, id });
}

/** Helper to execute prepared student lookup with parameter binding. */
export async function executePreparedStudentLookup(subdomain: string, id: string) {
  const stmt = getPreparedStudentById();
  return stmt.execute({ subdomain, id });
}

/** Helper to execute prepared session lookup with parameter binding. */
export async function executePreparedSessionLookup(subdomain: string, id: string) {
  const stmt = getPreparedSessionById();
  return stmt.execute({ subdomain, id });
}
