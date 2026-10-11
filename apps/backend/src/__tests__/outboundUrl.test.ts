import { describe, expect, it } from "vitest";
import { safeExternalHttpUrl, safeOptionalExternalHttpUrl } from "../lib/outboundUrl.js";

describe("outbound URL guard", () => {
  it("allows public HTTP(S) URLs", () => {
    expect(safeExternalHttpUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
    expect(safeOptionalExternalHttpUrl(undefined)).toBeUndefined();
  });

  it("blocks private and local hosts", () => {
    expect(() => safeExternalHttpUrl("http://localhost:11434")).toThrow(/not allowed/);
    expect(() => safeExternalHttpUrl("http://127.0.0.1:11434")).toThrow(/not allowed/);
    expect(() => safeExternalHttpUrl("http://192.168.1.10")).toThrow(/not allowed/);
    expect(() => safeExternalHttpUrl("http://169.254.169.254")).toThrow(/not allowed/);
  });

  it("blocks non-HTTP protocols", () => {
    expect(() => safeExternalHttpUrl("file:///etc/passwd")).toThrow(/HTTP or HTTPS/);
  });
});
