import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  MessageTemplate,
  StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import { useMessageComposerDispatch } from "./useMessageComposerDispatch";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/clientErrorReporting", () => ({ reportClientError }));

const { mutations } = vi.hoisted(() => ({
  mutations: {
    recordDispatches: vi.fn().mockResolvedValue({ success: true }),
    dispatchServerSms: { mutateAsync: vi.fn() },
    dispatchServerEmail: { mutateAsync: vi.fn() },
    dispatchServerWhatsApp: { mutateAsync: vi.fn() },
  },
}));
vi.mock("@/hooks/useMessaging", () => ({ useMessagingMutations: () => mutations }));

const recipient: MessagingRecipient = {
  id: "contact-1",
  name: "Ahmad Khan",
  phone: "+923001234567",
  email: "ahmad@example.com",
};

const templates: MessageTemplate[] = [];

type DispatchApi = ReturnType<typeof useMessageComposerDispatch>;

let api: DispatchApi | null = null;
let onClose: ReturnType<typeof vi.fn>;

function Host(props: { message: string; useServerGateway: boolean }): React.JSX.Element | null {
  api = useMessageComposerDispatch({
    channel: "sms",
    recipients: [recipient],
    activeTemplates: templates,
    templateId: "custom",
    subject: "",
    message: props.message,
    onClose: onClose as unknown as () => void,
    useServerGateway: props.useServerGateway,
  });
  return null;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useMessageComposerDispatch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    onClose = vi.fn();
    mutations.dispatchServerSms.mutateAsync.mockReset();
    mutations.dispatchServerEmail.mutateAsync.mockReset();
    mutations.dispatchServerWhatsApp.mutateAsync.mockReset();
    reportClientError.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    api = null;
  });

  async function renderHost(useServerGateway: boolean, message = "Salaam"): Promise<void> {
    await act(async () => {
      root.render(<Host message={message} useServerGateway={useServerGateway} />);
    });
  }

  it("does not dispatch a batch twice when Save fires twice in the same frame", async () => {
    const pending = deferred<{ sentCount: number }>();
    mutations.dispatchServerSms.mutateAsync.mockReturnValue(pending.promise);
    await renderHost(true);

    await act(async () => {
      const first = api?.sendAll();
      const second = api?.sendAll();
      pending.resolve({ sentCount: 1 });
      await Promise.all([first, second]);
    });

    expect(mutations.dispatchServerSms.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not dispatch one recipient twice when Send is activated twice", async () => {
    const pending = deferred<{ sentCount: number }>();
    mutations.dispatchServerSms.mutateAsync.mockReturnValue(pending.promise);
    await renderHost(true);

    await act(async () => {
      const first = api?.sendOne(recipient);
      const second = api?.sendOne(recipient);
      pending.resolve({ sentCount: 1 });
      await Promise.all([first, second]);
    });

    expect(mutations.dispatchServerSms.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resolves a failed server dispatch instead of leaving a rejected promise", async () => {
    const failure = new Error("dispatch failed");
    mutations.dispatchServerSms.mutateAsync.mockRejectedValue(failure);
    await renderHost(true);

    await act(async () => {
      await expect(api?.sendAll()).resolves.toBeUndefined();
    });

    expect(reportClientError).toHaveBeenCalledWith(failure, {
      context: "messaging.composer.sendAll",
    });
    // The modal stays open so the retry can reuse the submission key.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resolves a failed single send and keeps the composer open", async () => {
    const failure = new Error("single failed");
    mutations.dispatchServerSms.mutateAsync.mockRejectedValue(failure);
    await renderHost(true);

    await act(async () => {
      await expect(api?.sendOne(recipient)).resolves.toBeUndefined();
    });

    expect(reportClientError).toHaveBeenCalledWith(failure, {
      context: "messaging.composer.sendOne",
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
