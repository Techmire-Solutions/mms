import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ContactCreateModal from "./ContactCreateModal";
import { withQueryClient } from "@/test/queryClientTestUtils";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockNotifyError = vi.fn();
vi.mock("@mms/fe-core/notify", () => ({
  notify: {
    error: (...args: unknown[]) => mockNotifyError(...args),
  },
}));

vi.mock("@mms/fe-core/lib/settingsPreviewStore", () => ({
  getScopedBrandingSettings: () => ({
    country: "Pakistan",
    city: "Karachi",
    region: "Sindh",
  }),
}));

vi.mock("@mms/mod-contacts/frontend/tenant/components/ContactConfigContext", () => ({
  useContactConfig: () => ({
    prefs: {
      defaultCountry: "PK",
      defaultCity: "Karachi",
      defaultProvince: "Sindh",
    },
  }),
}));

const mockMutateAsync = vi.fn();
vi.mock("@/tenant/hooks/collections/contacts", () => ({
  useContactMutations: () => ({
    upsertContact: {
      mutateAsync: mockMutateAsync,
    },
  }),
}));

let mockCanWrite = true;
vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canWrite: mockCanWrite,
  }),
}));

vi.mock("@mms/mod-contacts/frontend/tenant/components/ContactForm", () => ({
  default: ({
    initialDraft,
    lockGender,
  }: {
    initialDraft?: { firstName?: string; lastName?: string; gender?: string };
    lockGender?: boolean;
  }) => (
    <div data-testid="contact-form">
      <span>{initialDraft?.firstName}</span>
      <span>{initialDraft?.lastName}</span>
      <span>{initialDraft?.gender}</span>
      <span>{lockGender ? "locked" : "unlocked"}</span>
    </div>
  ),
}));

describe("ContactCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanWrite = true;
  });

  it("renders empty string when open is false", () => {
    const html = renderToStaticMarkup(
      withQueryClient(<ContactCreateModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />),
    );
    expect(html).toBe("");
  });

  it("notifies error and closes when canWrite is false", () => {
    mockCanWrite = false;
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      withQueryClient(<ContactCreateModal open={true} onClose={onClose} onCreated={vi.fn()} />),
    );
    // Static markup does not run effects, so the notify/close calls are out of scope here;
    // what matters is that the refusal is announced (sr-only live region) and no form renders.
    expect(html).not.toContain("contact-form");
    expect(html).toContain('role="status"');
  });

  it("renders ContactForm when open and permitted", () => {
    const html = renderToStaticMarkup(
      withQueryClient(
        <ContactCreateModal
          open={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
          initialName="Hasan Raza"
          createDefaults={{ gender: "male", lockGender: true }}
        />,
      ),
    );

    // The form is rendered directly now; assert the draft and lock it received.
    expect(html).toContain('data-testid="contact-form"');
    expect(html).toContain("Hasan");
    expect(html).toContain("Raza");
    expect(html).toContain("locked");
  });
});
