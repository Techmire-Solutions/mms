import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Mail } from "lucide-react";
import { IntegrationPanelChrome } from "./IntegrationPanelChrome";

describe("IntegrationPanelChrome Component (@shared/ui)", () => {
  const baseProps = {
    icon: Mail,
    title: "Email Integration",
    description: "Configure SMTP settings",
    calloutText: "Ensure port 587 is unblocked",
    connected: true,
    lastTestOk: true,
    statusConnectedText: "Connected",
    statusNotConnectedText: "Not connected",
    loading: false,
    lastError: null,
    saving: false,
    testing: false,
    saveLabel: "Save Configuration",
    testLabel: "Send Test Email",
    onSave: vi.fn(),
    onTest: vi.fn(),
  };

  it("renders loading skeleton when loading is true", () => {
    const html = renderToStaticMarkup(
      <IntegrationPanelChrome {...baseProps} loading={true}>
        <div>Fields</div>
      </IntegrationPanelChrome>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("Email Integration");
  });

  it("renders header, status badge, callout, and children in standard view", () => {
    const html = renderToStaticMarkup(
      <IntegrationPanelChrome {...baseProps}>
        <div data-testid="field-host">Host Input</div>
      </IntegrationPanelChrome>,
    );

    expect(html).toContain("Email Integration");
    expect(html).toContain("Configure SMTP settings");
    expect(html).toContain("Connected");
    expect(html).toContain("Ensure port 587 is unblocked");
    expect(html).toContain('data-testid="field-host"');
    expect(html).toContain("Save Configuration");
    expect(html).toContain("Send Test Email");
  });

  it("renders error message when lastError is provided and lastTestOk is false", () => {
    const html = renderToStaticMarkup(
      <IntegrationPanelChrome
        {...baseProps}
        connected={false}
        lastTestOk={false}
        lastError="Connection timed out"
      >
        <div>Fields</div>
      </IntegrationPanelChrome>,
    );

    expect(html).toContain("Not connected");
    expect(html).toContain("Connection timed out");
  });

  it("stacks the status badge below the copy on narrow screens", () => {
    // Regression guard for the 2026-10-31 review (UX-01): the badge used to
    // share the row with the icon and text, shrinking the copy column to 58px
    // at 375px.
    const html = renderToStaticMarkup(
      <IntegrationPanelChrome {...baseProps}>
        <div>Fields</div>
      </IntegrationPanelChrome>,
    );
    expect(html).toContain("sm:flex-row");
    expect(html).toContain("min-w-0 flex-1");
    expect(html).toContain("self-start ps-12 sm:ps-0");
  });

  it("renders footer content when provided", () => {
    const html = renderToStaticMarkup(
      <IntegrationPanelChrome
        {...baseProps}
        footerContent={<p data-testid="footer-note">Custom footer</p>}
      >
        <div>Fields</div>
      </IntegrationPanelChrome>,
    );

    expect(html).toContain('data-testid="footer-note"');
    expect(html).toContain("Custom footer");
  });
});
