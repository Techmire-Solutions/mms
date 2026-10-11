import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ContactAction,
  ContactPhoneAction,
  ContactEmailAction,
  ContactLocationAction,
  ContactLinkAction,
} from "./ContactAction";

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

  describe("Polymorphic ContactAction wrapper", () => {
    it("dispatches to phone action when type is phone", () => {
      const html = renderToStaticMarkup(<ContactAction type="phone" phone="+92 300 1234567" />);

      expect(html).toContain('href="tel:+923001234567"');
    });

    it("dispatches to email action when type is email", () => {
      const html = renderToStaticMarkup(<ContactAction type="email" email="admin@mms.org" />);

      expect(html).toContain('href="mailto:admin@mms.org"');
    });

    it("dispatches to location action when type is location", () => {
      const html = renderToStaticMarkup(
        <ContactAction type="location" address="123 Main Street, Karachi" />,
      );

      expect(html).toContain("123 Main Street, Karachi");
      expect(html).toContain("maps.google.com");
    });

    it("dispatches to link action when type is link", () => {
      const html = renderToStaticMarkup(
        <ContactAction type="link" href="https://example.com" text="example.com" />,
      );

      expect(html).toContain("example.com");
      expect(html).toContain('href="https://example.com"');
    });
  });

  describe("ContactLocationAction", () => {
    it("renders address with map link and copy action", () => {
      const html = renderToStaticMarkup(
        <ContactLocationAction address="123 Main Street, Karachi" />,
      );

      expect(html).toContain("123 Main Street, Karachi");
      expect(html).toContain('href="https://maps.google.com/?q=123%20Main%20Street%2C%20Karachi"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it("supports pill variant for address", () => {
      const html = renderToStaticMarkup(
        <ContactLocationAction address="Karachi, Pakistan" variant="pill" />,
      );

      expect(html).toContain("Karachi, Pakistan");
      expect(html).toContain("group/pill");
      expect(html).toContain("maps.google.com");
    });
  });

  describe("ContactLinkAction", () => {
    it("renders link with target and copy action", () => {
      const html = renderToStaticMarkup(
        <ContactLinkAction href="https://github.com" text="github.com" />,
      );

      expect(html).toContain("github.com");
      expect(html).toContain('href="https://github.com"');
      expect(html).toContain('target="_blank"');
    });

    it("supports pill variant for links", () => {
      const html = renderToStaticMarkup(
        <ContactLinkAction href="https://twitter.com/madrasa" text="@madrasa" variant="pill" />,
      );

      expect(html).toContain("@madrasa");
      expect(html).toContain("group/pill");
    });
  });
});
