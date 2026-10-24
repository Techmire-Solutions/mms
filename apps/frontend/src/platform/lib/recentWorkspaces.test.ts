import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  loadRecentWorkspaces,
  saveRecentWorkspace,
  RECENT_WORKSPACES_STORAGE_KEY,
} from "./recentWorkspaces";

describe("recentWorkspaces", () => {
  beforeEach(() => {
    localStorage.removeItem(RECENT_WORKSPACES_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(RECENT_WORKSPACES_STORAGE_KEY);
  });

  it("given empty storage, should return an empty list", () => {
    expect(loadRecentWorkspaces()).toEqual([]);
  });

  it("given a saved workspace, should put it first and dedupe later saves", () => {
    saveRecentWorkspace({ subdomain: "a", madrasaName: "Alpha" });
    saveRecentWorkspace({ subdomain: "b", madrasaName: "Beta" });
    saveRecentWorkspace({ subdomain: "a", madrasaName: "Alpha Updated" });

    expect(loadRecentWorkspaces()).toEqual([
      { subdomain: "a", madrasaName: "Alpha Updated" },
      { subdomain: "b", madrasaName: "Beta" },
    ]);
  });
});
