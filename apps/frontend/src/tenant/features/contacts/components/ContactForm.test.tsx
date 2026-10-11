import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactForm } from "./ContactForm";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `Editing ${params.name}`;
      return key;
    },
    dir: "ltr",
  }),
}));

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    language: "en",
  }),
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    enabledTabIds: new Set(["basic", "phones", "emails", "addresses"]),
  }),
}));

vi.mock("@/tenant/features/contacts/hooks/useContactFormDraft", () => ({
  useContactFormDraft: () => ({
    contactDraft: { firstName: "Zayd", lastName: "Harith" },
    collectionCounts: { filledPhones: 1 },
    isDirty: false,
    saving: false,
    lookupsError: false,
    validationErrors: [],
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    children,
    footerStart,
    formId,
  }: {
    title: string;
    children: React.ReactNode;
    footerStart?: React.ReactNode;
    formId?: string;
  }) => (
    <div data-testid="form-modal" data-form-id={formId}>
      <h2>{title}</h2>
      <div>{footerStart}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("./ContactFormTabContent", () => ({
  ContactFormTabContent: () => <div data-testid="tab-content">Tab Content</div>,
}));

vi.mock("./ContactFormFooterStart", () => ({
  ContactFormFooterStart: () => <div data-testid="footer-start">Footer Start</div>,
}));

vi.mock("@/components/ui/ConfirmAlertDialog", () => ({
  ConfirmAlertDialog: () => null,
}));

describe("ContactForm Component", () => {
  it("renders create contact form modal", () => {
    const html = renderToStaticMarkup(
      <ContactForm open={true} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(html).toContain("contacts.form.addTitle");
    expect(html).toContain("Tab Content");
    expect(html).toContain("Footer Start");
  });

  it("given two open contact forms, should give each its own form id when one is a nested create", () => {
    // Arrange
    const onClose = vi.fn();
    const onSave = vi.fn();

    // Act
    const html = renderToStaticMarkup(
      <>
        <ContactForm open onClose={onClose} onSave={onSave} />
        <ContactForm open onClose={onClose} onSave={onSave} />
      </>,
    );

    // Assert
    const formIds = [...html.matchAll(/data-form-id="([^"]+)"/g)].map((match) => match[1]);
    expect(formIds).toHaveLength(2);
    expect(formIds[0]).not.toBe(formIds[1]);
    expect(html).toContain(`id="${formIds[0]}"`);
    expect(html).toContain(`id="${formIds[1]}"`);
  });
});
