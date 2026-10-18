import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GoogleContactsConnectStep } from "./GoogleContactsConnectStep";

describe("GoogleContactsConnectStep Component", () => {
  it("renders connect button when showAuthCode is false", () => {
    const html = renderToStaticMarkup(
      <GoogleContactsConnectStep
        showAuthCode={false}
        authCode=""
        exchanging={false}
        error=""
        onConnect={vi.fn()}
        onAuthCodeChange={vi.fn()}
        onExchangeCode={vi.fn()}
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("contacts.sync.credentialsSaved");
    expect(html).toContain("contacts.sync.connectGoogle");
  });

  it("renders auth code input when showAuthCode is true", () => {
    const html = renderToStaticMarkup(
      <GoogleContactsConnectStep
        showAuthCode={true}
        authCode="auth-code-123"
        exchanging={false}
        error=""
        onConnect={vi.fn()}
        onAuthCodeChange={vi.fn()}
        onExchangeCode={vi.fn()}
        t={((k: string) => k) as unknown as never}
      />,
    );

    expect(html).toContain("contacts.sync.pasteAuthCode");
    expect(html).toContain("contacts.sync.confirmAuth");
  });
});
