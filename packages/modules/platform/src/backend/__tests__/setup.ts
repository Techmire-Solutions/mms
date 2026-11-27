import { configurePlatformPorts } from "../platform/deps.js";

// Permissive default for every app-bound platform port: callable, chainable and
// awaitable. Suites override specific bindings with partial deps mocks.
const anyFn: any = new Proxy(function stub() {}, {
  get: (_t, key) => (key === "then" ? undefined : anyFn),
  apply: () => anyFn,
});
configurePlatformPorts(new Proxy({}, { get: () => anyFn }) as Record<string, any>);

export const platformTestStub = anyFn;
