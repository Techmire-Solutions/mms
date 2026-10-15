import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  useZodDraftForm,
  type UseZodDraftFormApi,
  type UseZodDraftFormOptions,
} from "./useZodDraftForm";
import type { ValidationError } from "./validationErrors";
import { notify } from "@/lib/notify";

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Draft = { name: string; note: string };
type Record_ = { name: string; note: string };

const baseOptions: UseZodDraftFormOptions<Draft, Record_> = {
  schema: z.object({
    name: z.string().min(1, "common.fieldRequired"),
    note: z.string().max(3, "common.tooLong"),
  }),
  toRecord: (draft: Draft): Record_ => ({ ...draft, name: draft.name.trim() }),
  resolveMessage: (message: string) => `msg:${message}`,
  earlyRules: (draft: Draft): Record<string, string> =>
    draft.name.trim() === "" ? { name: "msg:earlyRequired" } : {},
};

let probeOptions = baseOptions;
let captured: UseZodDraftFormApi<Draft, Record_> | null = null;

const RuntimeProbe: React.FC<{ initial: Draft }> = ({ initial }) => {
  captured = useZodDraftForm(initial, probeOptions);
  return null;
};

function mountHook(): {
  result: UseZodDraftFormApi<Draft, Record_>;
  root: Root;
  container: HTMLDivElement;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(RuntimeProbe, { initial: { name: "", note: "" } }));
  });
  const result = captured!;
  return { result, root, container };
}

async function refresh(
  h: ReturnType<typeof mountHook>,
): Promise<{ result: UseZodDraftFormApi<Draft, Record_> }> {
  await act(async () => {
    h.root.render(React.createElement(RuntimeProbe, { initial: { name: "", note: "" } }));
  });
  return { result: captured! };
}

describe("useZodDraftForm", () => {
  let mount: ReturnType<typeof mountHook> | null;

  beforeEach(() => {
    probeOptions = baseOptions;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (mount) {
      act(() => {
        mount!.root.unmount();
      });
      mount!.container.remove();
      mount = null;
    }
    document.body.innerHTML = "";
  });

  it("save passes early rules → schema and re-baselines on success", async () => {
    mount = mountHook();
    act(() => mount!.result.updateDraft({ name: "Ali", note: "ok" }));
    const re = await refresh(mount);
    expect(re.result.isDirty).toBe(true);

    const onSave = vi.fn();
    await act(async () => {
      expect(await re.result.save(onSave)).toBe(true);
    });
    const fin = await refresh(mount);

    expect(onSave).toHaveBeenCalledWith({ name: "Ali", note: "ok" });
    expect(fin.result.errors).toEqual({});
    expect(fin.result.isDirty).toBe(false);
    expect(fin.result.isSaving).toBe(false);
  });

  it("reports early-rule failures without calling onSave", async () => {
    mount = mountHook();
    const onSave = vi.fn();
    await act(async () => {
      expect(await mount!.result.save(onSave)).toBe(false);
    });
    const re = await refresh(mount);

    expect(re.result.errors).toEqual({ name: "msg:earlyRequired" });
    expect(re.result.validationErrors).toEqual([]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("maps schema failures into field errors and the ValidationError contract", async () => {
    mount = mountHook();
    act(() => mount!.result.updateDraft({ name: "Ali", note: "too-long-note" }));
    const re = await refresh(mount);

    const onSave = vi.fn();
    await act(async () => {
      expect(await re.result.save(onSave)).toBe(false);
    });
    const fin = await refresh(mount);

    expect(fin.result.errors.note).toBe("msg:common.tooLong");
    expect(fin.result.validationErrors.length).toBeGreaterThanOrEqual(1);
    const first: ValidationError = fin.result.validationErrors[0];
    expect(first).toMatchObject({ tabId: "basic" });
    expect(first.message.startsWith("msg:")).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("notifies the fallback message on validation failures", async () => {
    mount = mountHook();
    await act(async () => {
      await mount!.result.save(vi.fn());
    });
    expect(notify.error).toHaveBeenCalledWith("msg:common.formPleaseFixErrors");
  });

  it("notifies the save-failed message when onSave throws", async () => {
    probeOptions = {
      ...baseOptions,
      saveFailedMessage: "sessions.toast.saveFailed",
    };
    mount = mountHook();
    act(() => mount!.result.updateDraft({ name: "Ali" }));
    const re = await refresh(mount);

    const onSave = vi.fn().mockRejectedValue(new Error("boom"));
    await act(async () => {
      expect(await re.result.save(onSave)).toBe(false);
    });
    expect(re.result.errors).toEqual({});
    expect(notify.error).toHaveBeenCalledWith("msg:sessions.toast.saveFailed");
  });

  it("resetDraft replaces the draft and clears dirty state", async () => {
    mount = mountHook();
    act(() => mount!.result.updateDraft({ name: "Ali" }));
    const re = await refresh(mount);
    expect(re.result.isDirty).toBe(true);

    act(() => mount!.result.resetDraft({ name: "Fatima", note: "reset" }));
    const fin = await refresh(mount);
    expect(fin.result.draft).toEqual({ name: "Fatima", note: "reset" });
    expect(fin.result.isDirty).toBe(false);
    expect(fin.result.errors).toEqual({});
  });
});
