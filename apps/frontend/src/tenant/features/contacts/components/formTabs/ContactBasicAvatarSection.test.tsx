import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBasicAvatarSection } from "./ContactBasicAvatarSection";
import { notify } from "@/lib/notify";
import { IMAGE_UPLOAD_MAX_INPUT_BYTES } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/tenant/features/contacts/components/ContactIdentityMeta", () => ({
  ContactIdentityMeta: () => <div data-testid="identity-meta">Identity Meta</div>,
}));

describe("ContactBasicAvatarSection Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders avatar preview and change photo trigger with 44px touch target", () => {
    const html = renderToStaticMarkup(
      <ContactBasicAvatarSection
        contactDraft={{ firstName: "Zayd", lastName: "Harith", gender: "male" }}
        formInstanceId="inst-1"
        cropSrc={null}
        setCropSrc={vi.fn()}
        updateDraft={vi.fn()}
        handleAvatarChange={vi.fn()}
      />,
    );

    expect(html).toContain("Zayd Harith");
    expect(html).toContain("Identity Meta");
    expect(html).toContain("before:-inset-2");
  });

  it("renders remove photo action when avatar exists and triggers updateDraft on click", async () => {
    const updateDraft = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ContactBasicAvatarSection
          contactDraft={{ firstName: "Fatima", avatar: "https://example.com/avatar.jpg" }}
          formInstanceId="inst-2"
          cropSrc={null}
          setCropSrc={vi.fn()}
          updateDraft={updateDraft}
          handleAvatarChange={vi.fn()}
        />,
      );
    });

    const removeBtn = container.querySelector("button[type='button']");
    expect(removeBtn).not.toBeNull();

    await act(async () => {
      removeBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(updateDraft).toHaveBeenCalledWith({ avatar: null });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows error toast when dropping a non-image file", async () => {
    const setCropSrc = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ContactBasicAvatarSection
          contactDraft={{ firstName: "Ali" }}
          formInstanceId="inst-3"
          cropSrc={null}
          setCropSrc={setCropSrc}
          updateDraft={vi.fn()}
          handleAvatarChange={vi.fn()}
        />,
      );
    });

    const dropZone = container.querySelector(".group");
    expect(dropZone).not.toBeNull();

    const textFile = new File(["not an image"], "notes.txt", { type: "text/plain" });
    const dropEvent = new Event("drop", { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [textFile] },
    });

    await act(async () => {
      dropZone?.dispatchEvent(dropEvent);
    });

    expect(notify.error).toHaveBeenCalledWith("account.photoUploadFailed");
    expect(setCropSrc).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows error toast when dropping an oversized image (> IMAGE_UPLOAD_MAX_INPUT_BYTES)", async () => {
    const setCropSrc = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ContactBasicAvatarSection
          contactDraft={{ firstName: "Ali" }}
          formInstanceId="inst-4"
          cropSrc={null}
          setCropSrc={setCropSrc}
          updateDraft={vi.fn()}
          handleAvatarChange={vi.fn()}
        />,
      );
    });

    const dropZone = container.querySelector(".group");
    expect(dropZone).not.toBeNull();

    const largeFile = new File([""], "large.png", { type: "image/png" });
    Object.defineProperty(largeFile, "size", { value: IMAGE_UPLOAD_MAX_INPUT_BYTES + 1024 });

    const dropEvent = new Event("drop", { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [largeFile] },
    });

    await act(async () => {
      dropZone?.dispatchEvent(dropEvent);
    });

    expect(notify.error).toHaveBeenCalledWith("contacts.form.avatarTooLarge");
    expect(setCropSrc).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("routes a large drop through the shared avatar file handler", async () => {
    const onAvatarFileSelect = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ContactBasicAvatarSection
          contactDraft={{ firstName: "Ali" }}
          formInstanceId="inst-large"
          cropSrc={null}
          setCropSrc={vi.fn()}
          updateDraft={vi.fn()}
          handleAvatarChange={vi.fn()}
          onAvatarFileSelect={onAvatarFileSelect}
        />,
      );
    });

    const dropZone = container.querySelector(".group");
    const largeFile = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(largeFile, "size", { value: 5 * 1024 * 1024 });
    const dropEvent = new Event("drop", { bubbles: true }) as unknown as DragEvent;
    Object.defineProperty(dropEvent, "dataTransfer", { value: { files: [largeFile] } });

    await act(async () => {
      dropZone?.dispatchEvent(dropEvent);
    });

    expect(onAvatarFileSelect).toHaveBeenCalledWith(largeFile);
    expect(notify.error).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
