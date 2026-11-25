import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailIntegrationConfig } from "@mms/contracts";
import type { Transporter } from "nodemailer";

const nodemailerMocks = vi.hoisted(() => ({ createTransport: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: { createTransport: nodemailerMocks.createTransport },
}));

import {
  buildHtmlFallback,
  createSmtpTransporter,
  escapeHtmlText,
  resolveSmtpTransportOptions,
  sendMailViaSmtp,
  verifySmtpConnection,
  type SmtpTransportOptions,
} from "../lib/smtpTransport.js";

function baseConfig(overrides: Partial<EmailIntegrationConfig> = {}): EmailIntegrationConfig {
  return {
    providerId: "gmail",
    fromAddress: "noreply@example.com",
    fromName: "",
    smtpUsername: "user@example.com",
    connected: false,
    hasCredentials: false,
    ...overrides,
  };
}

function mockTransporter() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: "m-1" }),
    verify: vi.fn().mockResolvedValue(true),
  };
}

describe("escapeHtmlText / buildHtmlFallback", () => {
  it("escapes HTML metacharacters", () => {
    expect(escapeHtmlText(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("builds the fallback HTML part with escaped text and <br/> line breaks", () => {
    expect(buildHtmlFallback("Hello <World>\nSecond line")).toBe(
      "<p>Hello &lt;World&gt;<br/>Second line</p>",
    );
  });
});

describe("resolveSmtpTransportOptions", () => {
  it("resolves a preset provider from the registry", () => {
    const options = resolveSmtpTransportOptions(baseConfig(), "pw");
    expect(options).toEqual({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: "user@example.com", pass: "pw" },
    });
  });

  it("applies custom_smtp overrides (host, port, secure)", () => {
    const options = resolveSmtpTransportOptions(
      baseConfig({
        providerId: "custom_smtp",
        smtpHost: "smtp.custom.example",
        smtpPort: 465,
        smtpSecure: true,
      }),
      "pw",
    );
    expect(options).toMatchObject({
      host: "smtp.custom.example",
      port: 465,
      secure: true,
    });
  });

  it("falls back to the preset port when custom_smtp omits it", () => {
    const options = resolveSmtpTransportOptions(
      baseConfig({ providerId: "custom_smtp", smtpHost: "smtp.custom.example" }),
      "pw",
    );
    expect(options).toMatchObject({ host: "smtp.custom.example", port: 587 });
  });

  it("rejects missing username, password, or from-address", () => {
    expect(resolveSmtpTransportOptions(baseConfig({ smtpUsername: "" }), "pw")).toBeNull();
    expect(resolveSmtpTransportOptions(baseConfig(), "")).toBeNull();
    expect(resolveSmtpTransportOptions(baseConfig({ fromAddress: "" }), "pw")).toBeNull();
  });

  it("rejects an invalid custom port", () => {
    expect(
      resolveSmtpTransportOptions(
        baseConfig({ providerId: "custom_smtp", smtpHost: "smtp.custom.example", smtpPort: 0 }),
        "pw",
      ),
    ).toBeNull();
  });

  it("rejects SSRF-blocked hostnames", () => {
    expect(
      resolveSmtpTransportOptions(
        baseConfig({ providerId: "custom_smtp", smtpHost: "127.0.0.1" }),
        "pw",
      ),
    ).toBeNull();
    expect(
      resolveSmtpTransportOptions(
        baseConfig({ providerId: "custom_smtp", smtpHost: "localhost" }),
        "pw",
      ),
    ).toBeNull();
  });
});

describe("createSmtpTransporter", () => {
  beforeEach(() => {
    nodemailerMocks.createTransport.mockReset();
  });

  it("merges the explicit SMTP timeout budget into the options", () => {
    const options: SmtpTransportOptions = {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "u", pass: "p" },
    };
    nodemailerMocks.createTransport.mockReturnValue(mockTransporter());
    createSmtpTransporter(options);
    expect(nodemailerMocks.createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "u", pass: "p" },
      connectionTimeout: expect.any(Number),
      greetingTimeout: expect.any(Number),
      socketTimeout: expect.any(Number),
    });
  });
});

describe("sendMailViaSmtp", () => {
  it("sends with the escaped text-derived HTML fallback when no html is given", async () => {
    const transporter = mockTransporter();
    const outcome = await sendMailViaSmtp(
      transporter as unknown as Transporter,
      {
        from: "noreply@example.com",
        to: "to@example.com",
        subject: "Subject",
        text: "Line <one>\nLine two",
      },
      "fallback failure",
    );
    expect(outcome).toEqual({ sent: true });
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: "noreply@example.com",
      to: "to@example.com",
      subject: "Subject",
      text: "Line <one>\nLine two",
      html: "<p>Line &lt;one&gt;<br/>Line two</p>",
    });
  });

  it("passes an explicit html body through untouched", async () => {
    const transporter = mockTransporter();
    await sendMailViaSmtp(
      transporter as unknown as Transporter,
      {
        from: "noreply@example.com",
        to: "to@example.com",
        subject: "Subject",
        text: "plain",
        html: "<b>rich</b>",
      },
      "fallback failure",
    );
    expect(transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ html: "<b>rich</b>" }),
    );
  });

  it("maps a thrown Error to the failure outcome with its message", async () => {
    const transporter = mockTransporter();
    transporter.sendMail.mockRejectedValue(new Error("SMTP boom"));
    const outcome = await sendMailViaSmtp(
      transporter as unknown as Transporter,
      { from: "a", to: "b", subject: "s", text: "t" },
      "fallback failure",
    );
    expect(outcome).toEqual({ sent: false, message: "SMTP boom" });
  });

  it("uses the fallback message for non-Error throws", async () => {
    const transporter = mockTransporter();
    transporter.sendMail.mockRejectedValue("boom");
    const outcome = await sendMailViaSmtp(
      transporter as unknown as Transporter,
      { from: "a", to: "b", subject: "s", text: "t" },
      "fallback failure",
    );
    expect(outcome).toEqual({ sent: false, message: "fallback failure" });
  });
});

describe("verifySmtpConnection", () => {
  it("reports ok on successful verify", async () => {
    const transporter = mockTransporter();
    await expect(
      verifySmtpConnection(transporter as unknown as Transporter, "verify failed"),
    ).resolves.toEqual({
      ok: true,
    });
  });

  it("maps verify failures to the failure outcome", async () => {
    const transporter = mockTransporter();
    transporter.verify.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      verifySmtpConnection(transporter as unknown as Transporter, "verify failed"),
    ).resolves.toEqual({
      ok: false,
      message: "ECONNREFUSED",
    });
  });
});
