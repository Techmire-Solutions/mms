import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contact } from "@mms/contracts";
import { useContactsMessagingActions } from "./useContactsMessagingActions.js";

const composer = vi.hoisted(() => ({
  canWriteMessaging: true,
  openComposer: vi.fn(),
}));
const notifyError = vi.hoisted(() => vi.fn());

vi.mock("./useMessageComposerState.js", () => ({
  useMessageComposerState: () => ({
    messagingTarget: null,
    openComposer: composer.openComposer,
    closeComposer: vi.fn(),
    canWriteMessaging: composer.canWriteMessaging,
  }),
}));
vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@mms/fe-core/notify", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  notify: { error: notifyError },
}));

const ahmad = {
  id: "c-1",
  firstName: "Ahmad",
  name: "Ahmad Khan",
  phones: [{ label: "Mobile", number: "3001234561", countryCode: "+92", isPrimary: true }],
  emails: [{ label: "Work", address: "ahmad@example.com", isPrimary: true }],
} as Contact;
const noAddress = {
  id: "c-2",
  firstName: "Bilal",
  name: "Bilal",
  phones: [],
  emails: [],
} as Contact;

type Actions = ReturnType<typeof useContactsMessagingActions>;

describe("useContactsMessagingActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let actions: Actions;
  let openSpy: ReturnType<typeof vi.spyOn>;

  function render(): void {
    function TestComponent() {
      actions = useContactsMessagingActions();
      return null;
    }
    act(() => root.render(<TestComponent />));
  }

  beforeEach(() => {
    composer.canWriteMessaging = true;
    composer.openComposer.mockReset();
    notifyError.mockReset();
    openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    openSpy.mockRestore();
  });

  it("opens the in-app composer with the contact as recipient when messaging is allowed", () => {
    render();
    act(() => actions.handleWhatsApp([ahmad]));
    expect(composer.openComposer).toHaveBeenCalledTimes(1);
    const [channel, recipients] = composer.openComposer.mock.calls[0] ?? [];
    expect(channel).toBe("whatsapp");
    expect(recipients).toHaveLength(1);
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back to the device app for one contact when the composer is not permitted", () => {
    composer.canWriteMessaging = false;
    render();
    act(() => actions.handleWhatsApp([ahmad]));
    expect(composer.openComposer).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith(
      "https://wa.me/923001234561",
      "_blank",
      "noopener,noreferrer",
    );
    act(() => actions.handleEmail([ahmad]));
    expect(window.open).toHaveBeenLastCalledWith(
      "mailto:ahmad@example.com",
      "_blank",
      "noopener,noreferrer",
    );
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("explains the denial when there is no device fallback", () => {
    composer.canWriteMessaging = false;
    render();
    act(() => actions.handleSms([noAddress]));
    act(() => actions.handleWhatsApp([ahmad, noAddress]));
    expect(window.open).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledTimes(2);
    expect(notifyError).toHaveBeenCalledWith("messaging.writeDenied");
  });
});
