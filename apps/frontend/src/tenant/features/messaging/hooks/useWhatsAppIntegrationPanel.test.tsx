import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WHATSAPP_INTEGRATION, type WhatsappIntegrationConfig } from "@mms/shared";
import { useWhatsAppIntegrationPanel } from "./useWhatsAppIntegrationPanel";

const api = vi.hoisted(() => ({
  fetchWhatsappIntegration: vi.fn(),
  saveWhatsappIntegration: vi.fn(),
  testWhatsappIntegration: vi.fn(),
}));

vi.mock("@/lib/whatsappIntegrationApi", () => api);
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let panel: ReturnType<typeof useWhatsAppIntegrationPanel> | null = null;

  function Host(): null {
    panel = useWhatsAppIntegrationPanel();
    return null;
  }

  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <Host />
      </QueryClientProvider>,
    );
  });

  return { root, container, get: () => panel };
}

async function flushAsync(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useWhatsAppIntegrationPanel", () => {
  const roots: Root[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => root.unmount());
    }
    api.fetchWhatsappIntegration.mockReset();
    api.saveWhatsappIntegration.mockReset();
    api.testWhatsappIntegration.mockReset();
    document.body.innerHTML = "";
  });

  it("loads the saved configuration on mount and exposes it through the form", async () => {
    api.fetchWhatsappIntegration.mockResolvedValueOnce({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      providerId: "meta",
      senderId: "+15551234567",
    });
    const { root, get } = renderPanel();
    roots.push(root);
    await flushAsync();

    expect(api.fetchWhatsappIntegration).toHaveBeenCalledTimes(1);
    expect(get()?.loading).toBe(false);
    expect(get()?.form.providerId).toBe("meta");
    expect(get()?.form.senderId).toBe("+15551234567");
    expect(get()?.testPhone).toBe("+15551234567");
  });

  it("saves the trimmed secret, clears it, and refreshes the gateway query", async () => {
    api.fetchWhatsappIntegration.mockResolvedValueOnce({ ...DEFAULT_WHATSAPP_INTEGRATION });
    api.saveWhatsappIntegration.mockImplementation(
      async (payload: WhatsappIntegrationConfig & { accountSecret?: string }) => ({
        ...payload,
        connected: true,
      }),
    );
    const { root, get } = renderPanel();
    roots.push(root);
    await flushAsync();

    act(() => get()?.setAccountSecret("  secret-token  "));
    await act(async () => get()?.handleSave());

    expect(api.saveWhatsappIntegration).toHaveBeenCalledWith(
      expect.objectContaining({ accountSecret: "secret-token" }),
    );
    expect(get()?.accountSecret).toBe("");
  });

  it("sends the test message to the entered phone after saving the current form", async () => {
    api.fetchWhatsappIntegration.mockResolvedValueOnce({
      ...DEFAULT_WHATSAPP_INTEGRATION,
      senderId: "",
    });
    api.saveWhatsappIntegration.mockImplementation(
      async (payload: WhatsappIntegrationConfig & { accountSecret?: string }) => ({
        ...payload,
      }),
    );
    api.testWhatsappIntegration.mockResolvedValueOnce({ ...DEFAULT_WHATSAPP_INTEGRATION });
    const { root, get } = renderPanel();
    roots.push(root);
    await flushAsync();

    act(() => get()?.setTestPhone("+923001234567"));
    await act(async () => get()?.handleTest());

    expect(api.testWhatsappIntegration).toHaveBeenCalledWith("+923001234567");
  });
});
