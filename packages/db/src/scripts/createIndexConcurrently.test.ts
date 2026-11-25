import { describe, expect, it } from "vitest";
import { parseArgs, type ParsedArgs } from "./createIndexConcurrently.js";

/**
 * `parseArgs` is the injection boundary of the out-of-band index builder: every value it
 * accepts is interpolated into DDL, so its rejections are security-relevant and must stay
 * pinned independently of the CLI wiring.
 */
function run(argv: string[]): ParsedArgs {
  const invocation = parseArgs(argv);
  if (invocation.kind !== "run") throw new Error("expected a run invocation");
  return invocation.args;
}

describe("createIndexConcurrently parseArgs", () => {
  it("builds a default index name from table and columns", () => {
    expect(run(["--table", "contacts", "--columns", "workspace_subdomain,deleted_at"])).toEqual({
      table: "contacts",
      columns: ["workspace_subdomain", "deleted_at"],
      include: undefined,
      using: undefined,
      name: "contacts_workspace_subdomain_deleted_at_cix",
      unique: false,
      where: undefined,
    });
  });

  it("accepts an explicit name, uniqueness, method, include and predicate", () => {
    const args = run([
      "--table",
      "audit_trail_events",
      "--columns",
      "workspace_subdomain",
      "--name",
      "audit_ws_cix",
      "--unique",
      "--using",
      "BTREE",
      "--include",
      "created_at",
      "--where",
      "deleted_at IS NULL",
    ]);
    expect(args).toMatchObject({
      name: "audit_ws_cix",
      unique: true,
      using: "btree",
      include: ["created_at"],
      where: "deleted_at IS NULL",
    });
  });

  it("returns a file invocation for --file without touching other flags", () => {
    expect(parseArgs(["--file", "packages/db/scripts/sql/x.sql"])).toEqual({
      kind: "run",
      args: { file: "packages/db/scripts/sql/x.sql", unique: false },
    });
  });

  it("short-circuits to help before any validation", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["--table", "bad name", "-h"])).toEqual({ kind: "help" });
  });

  it.each([
    ["statement terminator", "deleted_at IS NULL; DROP TABLE contacts"],
    ["line comment", "deleted_at IS NULL -- x"],
    ["block comment", "deleted_at IS NULL /* x */"],
  ])("refuses a --where containing a %s", (_label, where) => {
    expect(() => parseArgs(["--table", "contacts", "--columns", "id", "--where", where])).toThrow(
      /statement terminators or comments/,
    );
  });

  it("refuses an unknown index method", () => {
    expect(() =>
      parseArgs(["--table", "contacts", "--columns", "id", "--using", "wobble"]),
    ).toThrow(/Invalid index method: wobble/);
  });

  it("refuses invalid identifiers", () => {
    expect(() => parseArgs(["--table", "contacts;drop", "--columns", "id"])).toThrow(
      /Invalid table name/,
    );
    expect(() => parseArgs(["--table", "contacts", "--columns", "id--"])).toThrow(
      /Invalid column list/,
    );
    expect(() =>
      parseArgs(["--table", "contacts", "--columns", "id", "--name", "bad name"]),
    ).toThrow(/Invalid index name/);
  });

  it("requires --table and --columns", () => {
    expect(() => parseArgs(["--table", "contacts"])).toThrow(/Usage: pnpm --filter @mms\/db/);
  });
});
