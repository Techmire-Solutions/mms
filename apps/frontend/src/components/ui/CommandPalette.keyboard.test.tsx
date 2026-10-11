import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { PlatformCommandPalette } from "@/platform/components/PlatformCommandPalette";
import type { CommandPaletteModalProps } from "./CommandPaletteModal";

const navigate = vi.fn();
let canSystem = true;
let modal: CommandPaletteModalProps;
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    canWorkspaces: true,
    canOnboard: true,
    canSystem,
    canAdmins: true,
  }),
}));
vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  usePlatformWorkspaces: () => ({ data: [] }),
}));
vi.mock("./CommandPaletteModal", () => ({
  CommandPaletteModal: (props: CommandPaletteModalProps) => {
    modal = props;
    return props.open ? (
      <>
        <input onKeyDown={props.onKeyDown} />
        {props.children}
      </>
    ) : null;
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe.each([
  ["tenant", CommandPalette, "accounting", /accounting/],
  ["platform", PlatformCommandPalette, "diagram", /erd/],
] as const)("%s command palette keyboard contract", (_host, Palette, search, path) => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const query = (value: string) => act(() => modal.onQueryChange(value));
  const key = (value: string) =>
    act(() => {
      container
        .querySelector("input")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }));
    });
  beforeEach(() => {
    vi.clearAllMocks();
    canSystem = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Palette open onClose={onClose} />));
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });
  it("dispatches the visible result and wraps only within search results", () => {
    query(search);
    const visibleId = modal.activeDescendantId;
    expect(visibleId).toBeTruthy();
    key("ArrowUp");
    expect(modal.activeDescendantId).toBe(visibleId);
    key("ArrowDown");
    expect(modal.activeDescendantId).toBe(visibleId);
    key("Enter");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(path);
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("clicks the same result that keyboard navigation highlights", () => {
    query(search);
    const option = document.getElementById(modal.activeDescendantId ?? "");
    expect(option).not.toBeNull();
    act(() => option?.click());
    expect(navigate.mock.calls[0]?.[0]).toMatch(path);
  });
  it("preserves the displayed search contract when closed and reopened", () => {
    query(search);
    act(() => root.render(<Palette open={false} onClose={onClose} />));
    expect(container.querySelector("input")).toBeNull();
    act(() => root.render(<Palette open onClose={onClose} />));
    expect(modal.query).toBe(search);
    expect(document.getElementById(modal.activeDescendantId ?? "")).not.toBeNull();
    key("Enter");
    expect(navigate.mock.calls[0]?.[0]).toMatch(path);
  });
  it("does not dispatch when search has no results", () => {
    query("zzzz-no-command");
    key("ArrowDown");
    key("ArrowUp");
    expect(modal.activeDescendantId).toBeUndefined();
    key("Enter");
    expect(navigate).not.toHaveBeenCalled();
    key("Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });
  if (_host === "platform") {
    it("does not dispatch a command removed by a permission update", () => {
      query(search);
      canSystem = false;
      act(() => root.render(<Palette open onClose={onClose} />));
      expect(modal.activeDescendantId).toBeUndefined();
      key("Enter");
      expect(navigate).not.toHaveBeenCalled();
    });
  }
  it("keeps a valid selection when the query shrinks the result list", () => {
    key("ArrowDown");
    key("ArrowDown");
    query(search);
    expect(modal.activeDescendantId).toBeTruthy();
    key("Enter");
    expect(navigate.mock.calls[0]?.[0]).toMatch(path);
  });
});
