import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact, AppTranslationKey } from "@mms/shared";
import {
  renderGenderMetadata,
  renderSyedMetadata,
  renderAddressFieldMetadata,
  renderWhatsAppMetadata,
} from "./contactMetadataIdentity";

const mockT = (key: AppTranslationKey): string => {
  const map: Partial<Record<AppTranslationKey, string>> = {
    "contacts.table.yesSyed": "Syed",
    "contacts.gender.male": "Male",
    "contacts.gender.female": "Female",
  };
  return map[key] ?? key;
};

describe("contactMetadataIdentity renderers", () => {
  const emptyNode = <span id="empty-fallback">—</span>;

  describe("renderGenderMetadata", () => {
    it("returns emptyNode when gender is missing or empty", () => {
      const html = renderToStaticMarkup(
        <div>{renderGenderMetadata({ contact: { id: "1" } as Contact, emptyNode, t: mockT })}</div>,
      );
      expect(html).toContain("empty-fallback");
    });

    it("renders male gender with text-info tone and localized label", () => {
      const html = renderToStaticMarkup(
        <div>
          {renderGenderMetadata({
            contact: { id: "1", gender: "male" } as Contact,
            emptyNode,
            t: mockT,
          })}
        </div>,
      );
      expect(html).toContain("Male");
      expect(html).toContain("text-info");
    });

    it("renders female gender with text-secondary tone and localized label", () => {
      const html = renderToStaticMarkup(
        <div>
          {renderGenderMetadata({
            contact: { id: "2", gender: "female" } as Contact,
            emptyNode,
            t: mockT,
          })}
        </div>,
      );
      expect(html).toContain("Female");
      expect(html).toContain("text-secondary");
    });
  });

  describe("renderSyedMetadata", () => {
    it("returns emptyNode when isSyed is false or undefined", () => {
      const html = renderToStaticMarkup(
        <div>
          {renderSyedMetadata({
            contact: { id: "1", isSyed: false } as Contact,
            emptyNode,
            t: mockT,
          })}
        </div>,
      );
      expect(html).toContain("empty-fallback");
    });

    it("renders success badge with yesSyed label when isSyed is true", () => {
      const html = renderToStaticMarkup(
        <div>
          {renderSyedMetadata({
            contact: { id: "1", isSyed: true } as Contact,
            emptyNode,
            t: mockT,
          })}
        </div>,
      );
      expect(html).toContain("Syed");
      expect(html).toContain("rounded-md");
    });
  });

  describe("renderAddressFieldMetadata", () => {
    it("returns emptyNode when field is missing", () => {
      const html = renderToStaticMarkup(
        <div>
          {renderAddressFieldMetadata({
            contact: { id: "1" } as Contact,
            colId: "city",
            emptyNode,
          })}
        </div>,
      );
      expect(html).toContain("empty-fallback");
    });

    it("renders flat contact address fields (city, country) when present", () => {
      const cityHtml = renderToStaticMarkup(
        <div>
          {renderAddressFieldMetadata({
            contact: { id: "1", city: "Lahore" } as Contact,
            colId: "city",
            emptyNode,
          })}
        </div>,
      );
      expect(cityHtml).toContain("Lahore");

      const countryHtml = renderToStaticMarkup(
        <div>
          {renderAddressFieldMetadata({
            contact: { id: "1", country: "Pakistan" } as Contact,
            colId: "country",
            emptyNode,
          })}
        </div>,
      );
      expect(countryHtml).toContain("Pakistan");
    });

    it("prefers structured primary address field over flat contact field", () => {
      const contact = {
        id: "1",
        city: "Rawalpindi",
        addresses: [{ isPrimary: true, city: "Islamabad" }],
      } as unknown as Contact;

      const html = renderToStaticMarkup(
        <div>{renderAddressFieldMetadata({ contact, colId: "city", emptyNode })}</div>,
      );
      expect(html).toContain("Islamabad");
    });
  });

  describe("renderWhatsAppMetadata", () => {
    it("renders status badge for contacts with WhatsApp", () => {
      const contact = {
        id: "1",
        phones: [{ isPrimary: true, isWhatsApp: true, number: "+923001234567" }],
      } as unknown as Contact;

      const html = renderToStaticMarkup(<div>{renderWhatsAppMetadata({ contact })}</div>);
      expect(html).toBeDefined();
    });
  });
});
