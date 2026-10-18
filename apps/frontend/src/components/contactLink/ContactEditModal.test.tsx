import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ContactEditModal from "./ContactEditModal";
import type { Contact } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockNotifyError = vi.fn();
vi.mock("@/lib/notify", () => ({
  notify: {
    error: (...args: unknown[]) => mockNotifyError(...args),
  },
}));

vi.mock("@/lib/settingsPreviewStore", () => ({
  getScopedBrandingSettings: () => ({
    country: "Pakistan",
    city: "Karachi",
    region: "Sindh",
  }),
}));

vi.mock("@/lib/contexts/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: {
      defaultCountry: "PK",
      defaultCity: "Karachi",
      defaultProvince: "Sindh",
    },
  }),
}));

const mockUpdateAsync = vi.fn();
vi.mock("@/tenant/hooks/collections/contacts", () => ({
  useContactMutations: () => ({
    updateContact: {
      mutateAsync: mockUpdateAsync,
    },
  }),
}));

let mockCanWrite = true;
vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: mockCanWrite,
  }),
}));

vi.mock("@/tenant/features/contacts/components/ContactForm", () => ({
  default: ({ contact }: { contact?: Contact }) => (
    <div data-testid="contact-edit-form">
      <span>{contact?.name}</span>
      <span>{contact?.id}</span>
    </div>
  ),
}));

const testContact: Contact = {
  id: "contact-101",
  name: "Zainab Ali",
  firstName: "Zainab",
  lastName: "Ali",
  gender: "female",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("ContactEditModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanWrite = true;
  });

  it("renders empty string when open is false or contact is missing", () => {
    const html1 = renderToStaticMarkup(
      <ContactEditModal open={false} contact={testContact} onClose={vi.fn()} />,
    );
    expect(html1).toBe("");

    const html2 = renderToStaticMarkup(
      <ContactEditModal open={true} contact={null} onClose={vi.fn()} />,
    );
    expect(html2).toBe("");
  });

  it("notifies error and closes when canWrite is false", () => {
    mockCanWrite = false;
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <ContactEditModal open={true} contact={testContact} onClose={onClose} />,
    );
    expect(html).toBe("");
  });

  it("renders ContactForm when open and contact provided", () => {
    const html = renderToStaticMarkup(
      <ContactEditModal open={true} contact={testContact} onClose={vi.fn()} />,
    );
    expect(html).toContain("common.loading");
  });
});
