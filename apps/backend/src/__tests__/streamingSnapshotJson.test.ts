import { describe, it, expect } from "vitest";
import { generateSnapshotJsonChunks } from "../routes/common/db/snapshotJsonStream.js";
import { generateSnapshotJsonFromSource } from "../lib/streamingSnapshotJson.js";
import type { TenantDatabaseSnapshot } from "@mms/shared";

async function collectString(generator: AsyncGenerator<string, void, unknown>): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of generator) chunks.push(chunk);
  return chunks.join("");
}

async function* fromEntries<T>(
  entries: [string, T][] | undefined,
): AsyncGenerator<[string, T], void, undefined> {
  if (!entries) return;
  for (const entry of entries) yield entry;
}

describe("streamingSnapshotJson parity", () => {
  it("produces JSON-equivalent output to generateSnapshotJsonChunks for the same snapshot", async () => {
    const snapshot: TenantDatabaseSnapshot = {
      collections: {
        genders: [{ id: "g-1" }, { id: "g-2" }],
        students: [
          { id: "s-1", name: "Ali", avatarUrl: "/uploads/avatars/ali.webp" },
          { id: "s-2", name: "Sara" },
        ],
      },
      objects: {
        branding: { madrasaName: "Dar ul Quran", logoUrl: "/uploads/branding/logo.webp" },
        email_integration: { provider: "smtp" },
      },
      assets: {
        "/uploads/avatars/ali.webp": "aGVsbG8=",
        "/uploads/branding/logo.webp": "bG9nbw==",
      },
    };

    const materialized = await collectString(generateSnapshotJsonChunks(snapshot));
    const streamed = await collectString(
      generateSnapshotJsonFromSource({
        collections: fromEntries(Object.entries(snapshot.collections ?? {})),
        objects: fromEntries(Object.entries(snapshot.objects ?? {})),
        assets: fromEntries(Object.entries(snapshot.assets ?? {})),
      }),
    );

    expect(JSON.parse(streamed)).toEqual(JSON.parse(materialized));
  });

  it("handles empty and partial sources (no collections/objects/assets)", async () => {
    const streamed = await collectString(
      generateSnapshotJsonFromSource({ collections: fromEntries(undefined) }),
    );
    expect(streamed).toBe('{"collections":{}}');

    const empty = await collectString(generateSnapshotJsonFromSource({}));
    expect(empty).toBe("{}");
  });

  it("preserves special characters and the exact shape of nested rows", async () => {
    const snapshot: TenantDatabaseSnapshot = {
      collections: {
        contacts: [
          {
            id: "c1",
            name: 'Zaid "the" Great',
            notes: 'line\nbreak & "quotes"',
            phones: [{ number: "+92 300 1112233" }],
          },
        ],
      },
      objects: {},
    };

    const materialized = await collectString(generateSnapshotJsonChunks(snapshot));
    const streamed = await collectString(
      generateSnapshotJsonFromSource({
        collections: fromEntries(Object.entries(snapshot.collections ?? {})),
        objects: fromEntries(Object.entries(snapshot.objects ?? {})),
      }),
    );
    expect(JSON.parse(streamed)).toEqual(JSON.parse(materialized));
  });
});
