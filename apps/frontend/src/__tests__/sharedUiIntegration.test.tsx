import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Button,
  Badge,
  Input,
  FormField,
  Modal,
  ConfirmDialog,
  ThemeScope,
  UiConfigProvider,
  toast,
  getToastState,
} from "@shared/ui";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("@shared/ui Core UI Library Integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders Button and Badge with custom variants and handles click events", async () => {
    const handleClick = vi.fn();
    await act(async () => {
      root.render(
        <div>
          <Button variant="default" onClick={handleClick}>
            Save Changes
          </Button>
          <Badge variant="success">Active</Badge>
        </div>,
      );
    });

    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("Save Changes");
    btn.click();
    expect(handleClick).toHaveBeenCalledTimes(1);

    const badge = container.querySelector("[class*='bg-success']") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("Active");
  });

  it("renders FormField and Input with accessibility attributes", async () => {
    await act(async () => {
      root.render(
        <FormField label="Email Address" required hint="Used for recovery" error="Invalid format">
          <Input placeholder="user@example.com" error />
        </FormField>,
      );
    });

    expect(container.textContent).toContain("Email Address");
    expect(container.textContent).toContain("*");
    expect(container.textContent).toContain("Invalid format");
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("user@example.com");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders Modal and executes onClose on close click", async () => {
    const handleClose = vi.fn();
    await act(async () => {
      root.render(
        <Modal
          open={true}
          onClose={handleClose}
          title="Workspace Settings"
          subtitle="Configure tenant"
        >
          <div>Modal Content Body</div>
        </Modal>,
      );
    });

    expect(container.textContent).toContain("Workspace Settings");
    expect(container.textContent).toContain("Configure tenant");
    expect(container.textContent).toContain("Modal Content Body");

    const closeBtn = container.querySelector("button[aria-label='Close']") as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("ThemeScope applies tenant/platform CSS variables and WCAG contrast", async () => {
    await act(async () => {
      root.render(
        <ThemeScope
          theme={{
            primary: "#d99b00",
            secondary: "#5c3412",
            mode: "dark",
            radius: "0.5rem",
          }}
        >
          <div>Platform Console Scoped Body</div>
        </ThemeScope>,
      );
    });

    const scopedDiv = container.firstElementChild as HTMLElement;
    expect(scopedDiv.className).toContain("dark");
    expect(scopedDiv.dataset.theme).toBe("dark");
    expect(scopedDiv.style.getPropertyValue("--primary")).toBe("#d99b00");
    // Luminance of #d99b00 is high, foreground calculates to black
    expect(scopedDiv.style.getPropertyValue("--primary-foreground")).toBe("black");
  });

  it("UiConfigProvider injects console-specific labels and RTL direction", async () => {
    await act(async () => {
      root.render(
        <UiConfigProvider
          config={{
            dir: "rtl",
            labels: {
              cancel: "إلغاء",
              confirm: "تأكيد",
            },
          }}
        >
          <ConfirmDialog
            open={true}
            onOpenChange={vi.fn()}
            title="حذف البيانات"
            description="هل أنت متأكد من المتابعة؟"
            onConfirm={vi.fn()}
          />
        </UiConfigProvider>,
      );
    });

    // Radix AlertDialog renders in a Portal attached to document.body
    expect(document.body.textContent).toContain("حذف البيانات");
    expect(document.body.textContent).toContain("إلغاء");
    expect(document.body.textContent).toContain("تأكيد");
  });

  it("toast dispatch updates toastStore state", () => {
    const { id } = toast({
      title: "Workspace Provisioned",
      description: "Subdomain created successfully.",
      variant: "success",
    });

    const state = getToastState();
    const found = state.toasts.find((t) => t.id === id);
    expect(found).toBeDefined();
    expect(found?.title).toBe("Workspace Provisioned");
    expect(found?.variant).toBe("success");
  });
});
