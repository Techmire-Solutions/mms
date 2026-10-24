import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ContactPhoneActionButtons } from "./ContactPhoneActionButtons";

describe("ContactPhoneActionButtons Component", () => {
  it("renders call, WhatsApp, SMS, and copy buttons when permitted", () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <ContactPhoneActionButtons
          canCall={true}
          canWa={true}
          canSms={true}
          canCopy={true}
          callLabel="Call +92 300 1234567"
          waLabel="WhatsApp +92 300 1234567"
          smsLabel="SMS +92 300 1234567"
          telHref="tel:+923001234567"
          waHref="https://wa.me/923001234567"
          smsHref="sms:+923001234567"
          formattedPhone="+92 300 1234567"
        />
      </TooltipProvider>,
    );

    expect(html).toContain('href="tel:+923001234567"');
    expect(html).toContain('aria-label="Call +92 300 1234567"');
    expect(html).toContain('href="https://wa.me/923001234567"');
    expect(html).toContain('aria-label="WhatsApp +92 300 1234567"');
    expect(html).toContain('href="sms:+923001234567"');
    expect(html).toContain('aria-label="SMS +92 300 1234567"');
    expect(html).toContain('aria-label="Copy"');
  });

  it("omits buttons when disabled or flags are false", () => {
    const html = renderToStaticMarkup(
      <ContactPhoneActionButtons
        canCall={false}
        canWa={false}
        canSms={false}
        canCopy={false}
        callLabel="Call"
        waLabel="WhatsApp"
        smsLabel="SMS"
        formattedPhone="+92 300 1234567"
      />,
    );

    expect(html).not.toContain("tel:");
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("sms:");
    expect(html).not.toContain('aria-label="Copy"');
  });
});
