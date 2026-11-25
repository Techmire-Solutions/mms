import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { useContactEntityDescriptor } from "./useContactEntityDescriptor.js";
import type { FieldDefinition as RegistryFieldDefinition } from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import type { Contact } from "@mms/contracts";

const registryField = (over: Partial<RegistryFieldDefinition>): RegistryFieldDefinition => ({
  key: "k",
  label: "L",
  type: "text",
  enabled: true,
  order: 1,
  ...over,
});

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({ t: (key: string) => `t:${key}`, dir: "ltr", language: "en" }),
}));

vi.mock(
  "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext",
  async (importOriginal) => ({
    ...((await importOriginal()) as Record<string, unknown>),
    useContactConfig: () => ({
      fields: {
        identity: [
          registryField({ key: "name", order: 10 }),
          registryField({ key: "gender", type: "select", order: 20 }),
          registryField({ key: "cnic", order: 30 }),
        ],
        contact: [registryField({ key: "email", type: "email", order: 10 })],
      },
    }),
  }),
);

vi.mock("@mms/fe-core/auth/AuthContext", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useOptionalAuth: () => ({ user: { role: "admin" } }),
  useAuth: () => ({ user: { role: "admin" } }),
}));

function renderHookWrapper() {
  let hookResult!: EntityDescriptor<Contact>;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useContactEntityDescriptor();
    return null;
  }

  act(() => {
    root.render(<TestComponent />);
  });

  return {
    get current() {
      return hookResult;
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useContactEntityDescriptor", () => {
  it("builds a descriptor from the runtime config with hero fields hidden from cards", () => {
    const hook = renderHookWrapper();
    const descriptor = hook.current;
    expect(descriptor.entityType).toBe("contacts");
    const keys = descriptor.getCardFields().map((field) => field.key);
    expect(keys).toContain("gender");
    expect(keys).toContain("cnic");
    expect(keys).not.toContain("name"); // hero — rendered by ContactCardHeader
    expect(keys).not.toContain("email"); // face — rendered by ContactCardInfoPills
    expect(descriptor.getField("gender")?.badgeVariantMap?.male?.className).toBeTruthy();
    expect(descriptor.getField("email")?.type).toBe("email");
    hook.cleanup();
  });
});
