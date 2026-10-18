import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { generateSnapshotJsonChunks } from "../routes/common/db/snapshotJsonStream.js";
import type { TenantDatabaseSnapshot } from "@mms/shared";

describe("snapshotJsonStream", () => {
  it("streams valid JSON with identical structure to JSON.stringify", async () => {
    const snapshot: TenantDatabaseSnapshot = {
      collections: {
        users: [
          { id: "u1", name: "Alice", role: "admin" },
          { id: "u2", name: "Bob", role: "teacher" },
        ],
        contacts: [{ id: "c1", firstName: "Charlie" }],
      },
      objects: {
        branding: { name: "Madrasa", color: "#123456" },
        settings: { active: true },
      },
      assets: {
        "/uploads/avatars/u1.webp": "base64imagedata==",
      },
    };

    const stream = Readable.from(generateSnapshotJsonChunks(snapshot));
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(String(chunk));
    }
    const fullJson = chunks.join("");
    const parsed = JSON.parse(fullJson);

    expect(parsed).toEqual(snapshot);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("handles empty and partial snapshots correctly", async () => {
    const snapshot: TenantDatabaseSnapshot = {};
    const stream = Readable.from(generateSnapshotJsonChunks(snapshot));
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(String(chunk));
    }
    const parsed = JSON.parse(chunks.join(""));
    expect(parsed).toEqual({});
  });

  it("streams custom top-level metadata properties correctly", async () => {
    const snapshot = {
      version: 2,
      exportedAt: "2026-09-04T00:00:00.000Z",
      ignoredUndefined: undefined,
      collections: { users: [{ id: "1" }] },
    } as unknown as TenantDatabaseSnapshot;

    const stream = Readable.from(generateSnapshotJsonChunks(snapshot));
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(String(chunk));
    }
    const parsed = JSON.parse(chunks.join(""));
    expect(parsed).toEqual({
      version: 2,
      exportedAt: "2026-09-04T00:00:00.000Z",
      collections: { users: [{ id: "1" }] },
    });
  });
});
