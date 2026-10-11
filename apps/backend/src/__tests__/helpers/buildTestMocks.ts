import { vi } from "vitest";

/**
 * Demo workspace fixture + getWorkspaceBySubdomain mock implementation
 * for backend inject() suites. Compose into `vi.mock('../services/workspaceService.js', ...)`.
 */
export function createDemoWorkspaceMock() {
  const demoWorkspace = {
    id: "ws-demo",
    subdomain: "demo",
    madrasaName: "Demo Madrasa",
    createdAt: "2026-01-01T00:00:00.000Z",
    enabled: true,
  };
  return {
    demoWorkspace,
    getWorkspaceBySubdomain: vi
      .fn()
      .mockImplementation(async (subdomain: string) =>
        subdomain === "demo" ? demoWorkspace : null,
      ),
  };
}
