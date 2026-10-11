import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleContactsConnectedState } from "./GoogleContactsConnectedState";

describe("GoogleContactsConnectedState Component", () => {
  it("renders connected status and sync action button", () => {
    const html = renderToStaticMarkup(
      <GoogleContactsConnectedState
        canWrite={true}
        error=""
        syncResult={{
          total: 10,
          imported: 5,
          updated: 3,
          skipped: 2,
          skippedUnique: 0,
          skippedName: 0,
        }}
        syncing={false}
        onDisconnect={vi.fn()}
        onSync={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("contacts.sync.googleConnectedTitle");
    expect(html).toContain("contacts.sync.disconnect");
    expect(html).toContain("contacts.sync.syncGoogle");
  });
});
