import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleContactsSetupForm, GoogleContactsSetupHint } from "./GoogleContactsSetupForm";

describe("GoogleContactsSetupForm Components", () => {
  it("renders setup hint", () => {
    const html = renderToStaticMarkup(<GoogleContactsSetupHint t={((k: string) => k) as any} />);

    expect(html).toContain("contacts.sync.oauthSetupTitle");
  });

  it("renders setup form fields and save buttons", () => {
    const html = renderToStaticMarkup(
      <GoogleContactsSetupForm
        clientId="my-client-id"
        clientSecret="my-secret"
        error=""
        onClientIdChange={vi.fn()}
        onClientSecretChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        t={((k: string) => k) as any}
      />,
    );

    expect(html).toContain("contacts.sync.clientIdLabel");
    expect(html).toContain("my-client-id");
    expect(html).toContain("contacts.sync.saveCredentials");
  });
});
