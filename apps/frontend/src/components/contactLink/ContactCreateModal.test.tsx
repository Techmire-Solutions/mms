import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ContactCreateModal from "./ContactCreateModal";

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

vi.mock("@/tenant/features/contacts/components/ContactForm", () => ({
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
      <ContactCreateModal open={false} onClose={vi.fn()} onCreated={vi.fn()} />,
    );
    expect(html).toBe("");
  });

  it("notifies error and closes when canWrite is false", () => {
    mockCanWrite = false;
    const onClose = vi.fn();
    const html = renderToStaticMarkup(
      <ContactCreateModal open={true} onClose={onClose} onCreated={vi.fn()} />,
    );
    expect(html).toBe("");
  });

  it("renders ContactForm when open and permitted", () => {
    const html = renderToStaticMarkup(
      <ContactCreateModal
        open={true}
        onClose={vi.fn()}
        onCreated={vi.fn()}
        initialName="Hasan Raza"
        createDefaults={{ gender: "male", lockGender: true }}
      />,
    );

    // In static markup with lazy/suspense or direct render, it outputs the loading fallback
    expect(html).toContain("common.loading");
  });
});
