import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Contact, ContactPreferences } from "@mms/shared";
import {
  renderContactNameCell,
  renderContactPhoneCell,
  renderContactEmailCell,
} from "./contactTablePrimaryCells";

const mockTranslate = ((key: string, params?: Record<string, string>) => {
  if (params?.name) return `${key} ${params.name}`;
  const labels: Record<string, string> = {
    "contacts.table.yesSyed": "Syed",
    "contacts.gender.female": "Female",
    "contacts.deletionReasonLabel": "Reason",
    "contacts.table.emptyDash": "—",
    "contacts.detail.call": "Call",
    "contacts.sms": "SMS",
    "contacts.whatsapp": "WhatsApp",
    "contacts.detail.emailAction": "Email",
  };
  return labels[key] ?? key;
}) as never;

const mockContact: Contact = {
  id: "cnt-tbl-1",
  name: "Zainab Zahra",
  firstName: "Zainab",
  lastName: "Zahra",
  gender: "female",
  isSyed: true,
  phones: [{ number: "+1 555-0144", label: "mobile", isPrimary: true }],
  emails: [{ address: "zainab@madrasa.com", label: "work", isPrimary: true }],
  deletionReason: "Duplicate entry",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockPrefs: ContactPreferences = {
  defaultCountry: "US",
  defaultProvince: "CA",
  defaultCity: "Los Angeles",
};

describe("contactTablePrimaryCells", () => {
  describe("renderContactNameCell", () => {
    it("renders name cell with avatar, name button, Syed badge, and deletion reason when archived", () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              {renderContactNameCell({
                contact: mockContact,
                displayName: "Zainab Zahra",
                widthStyle: { width: 250 },
                showArchived: true,
                isSelected: false,
                t: mockTranslate,
                onView: vi.fn(),
              })}
            </tr>
          </tbody>
        </table>,
      );

      expect(html).toContain("Zainab Zahra");
      expect(html).toContain("Female");
      expect(html).toContain("Syed");
      expect(html).toContain("Reason: Duplicate entry");
    });
  });

  describe("renderContactPhoneCell", () => {
    it("renders phone action buttons when phones exist", () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              {renderContactPhoneCell({
                contact: mockContact,
                prefs: mockPrefs,
                countryCodesMap: {},
                countryCodes: [],
                widthStyle: undefined,
                t: mockTranslate,
                onWhatsApp: vi.fn(),
              })}
            </tr>
          </tbody>
        </table>,
      );

      expect(html).toContain("+1");
      expect(html).toContain("555-0144");
    });

    it("renders empty dash when no phones exist", () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              {renderContactPhoneCell({
                contact: { ...mockContact, phones: undefined, phone: undefined },
                prefs: mockPrefs,
                countryCodesMap: {},
                countryCodes: [],
                widthStyle: undefined,
                t: mockTranslate,
              })}
            </tr>
          </tbody>
        </table>,
      );

      expect(html).toContain("—");
    });
  });

  describe("renderContactEmailCell", () => {
    it("renders email action buttons when emails exist", () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              {renderContactEmailCell({
                contact: mockContact,
                widthStyle: undefined,
                t: mockTranslate,
              })}
            </tr>
          </tbody>
        </table>,
      );

      expect(html).toContain("zainab@madrasa.com");
    });

    it("renders empty dash when no emails exist", () => {
      const html = renderToStaticMarkup(
        <table>
          <tbody>
            <tr>
              {renderContactEmailCell({
                contact: { ...mockContact, emails: undefined, email: undefined },
                widthStyle: undefined,
                t: mockTranslate,
              })}
            </tr>
          </tbody>
        </table>,
      );

      expect(html).toContain("—");
    });
  });
});

describe("contactTablePrimaryCells BiDi isolation", () => {
  it("sets dir=auto on the table name so mixed-script names keep their base direction", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            {renderContactNameCell({
              contact: { ...mockContact, name: "محمد Ali", firstName: "محمد" },
              displayName: "محمد Ali",
              widthStyle: undefined,
              showArchived: false,
              isSelected: false,
              t: mockTranslate,
              onView: vi.fn(),
            })}
          </tr>
        </tbody>
      </table>,
    );

    expect(html).toContain('dir="auto"');
    expect(html).toContain("محمد Ali");
  });
});
