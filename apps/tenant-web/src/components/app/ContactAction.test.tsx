import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContactPhoneAction,
  ContactEmailAction,
} from "@mms/mod-contacts/frontend/components/ContactAction";

describe("ContactAction Primitives", () => {
  describe("ContactPhoneAction", () => {
    it("renders formatted phone and action links for tel, sms, and wa.me", () => {
      const html = renderToStaticMarkup(<ContactPhoneAction phone="+92 300 1234567" />);

      expect(html).toContain("+92");
      expect(html).toContain("300 1234567");
      expect(html).toContain('href="tel:+923001234567"');
      expect(html).toContain('href="https://wa.me/923001234567"');
      expect(html).toContain('href="sms:+923001234567"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it("includes accessible aria-labels on action buttons", () => {
      const html = renderToStaticMarkup(<ContactPhoneAction phone="+92 300 1234567" name="Ali" />);

      expect(html).toContain('aria-label="Call +92 300 1234567 (Ali)"');
      expect(html).toContain('aria-label="WhatsApp +92 300 1234567 (Ali)"');
      expect(html).toContain('aria-label="SMS +92 300 1234567 (Ali)"');
    });

    it("renders fallback dash and no broken links when phone is null or empty", () => {
      const html = renderToStaticMarkup(<ContactPhoneAction phone={null} />);

      expect(html).toContain("—");
      expect(html).not.toContain("tel:");
      expect(html).not.toContain("wa.me");
      expect(html).not.toContain("sms:");
    });

    it("keeps local numbers local when no country code is configured", () => {
      const html = renderToStaticMarkup(<ContactPhoneAction phone="0300 1234567" />);

      expect(html).toContain('href="tel:03001234567"');
      expect(html).toContain('href="sms:03001234567"');
      expect(html).not.toContain("wa.me");
      expect(html).not.toContain("+92");
    });

    it("supports pill variant with inline value and action links", () => {
      const html = renderToStaticMarkup(
        <ContactPhoneAction phone="+92 300 1234567" variant="pill" />,
      );

      expect(html).toContain("+92 300 1234567");
      expect(html).toContain('href="tel:+923001234567"');
      expect(html).toContain('href="https://wa.me/923001234567"');
      expect(html).toContain('href="sms:+923001234567"');
      expect(html).toContain("group/pill");
    });
  });

  describe("ContactEmailAction", () => {
    it("renders email and mailto action link", () => {
      const html = renderToStaticMarkup(<ContactEmailAction email="info@madrasa.org" />);

      expect(html).toContain("info@madrasa.org");
      expect(html).toContain('href="mailto:info@madrasa.org"');
      expect(html).toContain('aria-label="Email info@madrasa.org"');
    });

    it("supports pill variant with inline email and mailto action link", () => {
      const html = renderToStaticMarkup(
        <ContactEmailAction email="info@madrasa.org" variant="pill" />,
      );

      expect(html).toContain("info@madrasa.org");
      expect(html).toContain('href="mailto:info@madrasa.org"');
      expect(html).toContain("group/pill");
    });

    it("renders fallback dash when email is empty", () => {
      const html = renderToStaticMarkup(<ContactEmailAction email="" />);

      expect(html).toContain("—");
      expect(html).not.toContain("mailto:");
    });
  });
});
