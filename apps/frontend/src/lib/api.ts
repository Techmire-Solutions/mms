/**
 * Type-safe @ts-rest/react-query client bound to the shared rootContract.
 * All requests flow through the existing `apiFetch` transport — preserving
 * CSRF headers, auth-refresh, request-ID, and timeout behaviour.
 */
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import { initClient } from "@ts-rest/core";
import { rootContract } from "@mms/shared";
import { apiFetch, resolveApiUrl } from "@/lib/apiClient";
import { apiContractError } from "@/lib/apiContractError";

type TsrFetcherArgs = {
  path: string;
  method: string;
  body?: unknown;
  rawBody?: unknown;
  headers: Record<string, string>;
  route: unknown;
  signal?: AbortSignal | null;
};

async function tsrApiFetcher(args: TsrFetcherArgs): Promise<{
  status: number;
  body: unknown;
  headers: Headers;
}> {
  const { path, method, body, rawBody, headers } = args;
  const url = resolveApiUrl(path);

  const requestBody: BodyInit | undefined =
    rawBody instanceof FormData
      ? rawBody
      : typeof body === "string"
        ? body
        : body !== undefined
          ? JSON.stringify(body)
          : undefined;

  const res = await apiFetch(url, {
    method,
    body: requestBody,
    headers: headers as HeadersInit,
    signal: args.signal,
  });

  let parsed: unknown;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    parsed = await res.json().catch(() => null);
  } else {
    parsed = await res.text().catch(() => "");
  }

  if (res.status === 401 || res.status === 403) {
    const isCredentialEndpoint =
      path.includes("/auth/change-password") || path.includes("/auth/login-email");
    if (!isCredentialEndpoint) {
      throw apiContractError(
        { status: res.status, body: parsed, headers: res.headers },
        `Authentication error (${res.status})`,
      );
    }
  }

  return { status: res.status, body: parsed, headers: res.headers };
}

/**
 * Structural view of the ts-rest react-query hooks container.
 *
 * WHY: @ts-rest 3.52.1's recursive `TsRestReactQueryHooksContainer` +
 * `ClientInferResponses` conditionals fail to instantiate against the 24-domain
 * root contract (and even a single heavy domain) under this TS toolchain, so
 * every `tsrClient.<domain>.<route>.useQuery/useMutation(...)` call degraded to
 * a non-callable union. That forced ~288 per-call
 * `@ts-expect-error - TS union discrimination limit with ts-rest` suppressions
 * across the feature hooks.
 *
 * Instead of 288 escapes, the container is widened ONCE here, in this reviewed
 * file. The requests are unchanged — the hooks still run through the same
 * `tsrApiFetcher` transport (CSRF / auth-refresh / request-id preserved) — and
 * feature code keeps reading the response envelope (`.data.{status,body,headers}`)
 * as before. Narrowing to domain types stays with the shared-contract SSOT.
 * See ADR-010.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- single documented ts-rest type escape (ADR-010)
type TsrHookOptions = Record<string, any>;
// The hooks' results are widened to `any` (not `unknown`): consumers spread the
// result object and read arbitrary envelope/result fields, exactly as they did
// when the per-call `@ts-expect-error` degraded the types. `unknown` would break
// spreads (index signatures do not spread) — see ADR-010.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- single documented ts-rest type escape (ADR-010)
type TsrHookResult = any;
type TsrHooksContainer = Record<
  string,
  Record<
    string,
    {
      useQuery: (options: TsrHookOptions) => TsrHookResult;
      useMutation: (options?: TsrHookOptions) => TsrHookResult;
    }
  >
>;

export const tsrClient = initTsrReactQuery(rootContract, {
  baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  api: tsrApiFetcher,
}) as unknown as TsrHooksContainer;

/**
 * Typed structural view over the direct-call client.
 *
 * WHY not the contract-generic `Client` type: @ts-rest 3.52.1 route
 * classification fails under TS 5.9 instantiation (even single-route contracts
 * do not satisfy `AppRoute`), so contract-generic clients degrade to
 * non-callable unions. Instead of `any`, callers get `unknown` request bodies
 * and responses — narrowing against the shared-contract SSOT happens at the
 * call site with explicit casts (unknown + narrowing, never any).
 */
type ApiCallArgs = {
  query?: object;
  params?: object;
  body?: unknown;
  rawBody?: unknown;
  extraHeaders?: Record<string, string>;
  fetchOptions?: { signal?: AbortSignal };
  signal?: AbortSignal;
};
type ApiCallResponse = { status: number; body: unknown; headers: Headers };
type ApiContract = Record<string, Record<string, (args?: ApiCallArgs) => Promise<ApiCallResponse>>>;

export const apiContract = initClient(rootContract, {
  baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  api: tsrApiFetcher,
}) as unknown as ApiContract;
