/**
 * Type-safe @ts-rest/react-query client bound to the shared rootContract.
 * All requests flow through the existing `apiFetch` transport — preserving
 * CSRF headers, auth-refresh, request-ID, and timeout behaviour.
 */
import { initTsrReactQuery } from "@ts-rest/react-query/v5";
import type { TsRestReactQueryHooksContainer } from "@ts-rest/react-query/v5";
import { initClient } from "@ts-rest/core";
import type { AppRouter } from "@ts-rest/core";
import {
  rootContract,
  type studentContract,
  type financeContract,
  type attendanceContract,
  type contactsContract,
  type facultyContract,
  type userContract,
  type messagingContract,
  type sessionContract,
  type questionBankContract,
  type accountingContract,
  type hasanatContract,
  type obligationContract,
  type examinationContract,
  type enrollmentContract,
  type dashboardContract,
  type savedReportsContract,
  type workspaceContract,
  type authContract,
  type profileContract,
  type publicContract,
  type aiContract,
  type platformContract,
} from "@mms/shared";
import { apiFetch, resolveApiUrl, ApiError } from "@/lib/apiClient";

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
      const errorBody =
        parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      const message =
        typeof errorBody.message === "string"
          ? errorBody.message
          : `Authentication error (${res.status})`;
      const type = typeof errorBody.type === "string" ? errorBody.type : undefined;
      const requestId = res.headers.get("x-request-id") ?? undefined;
      const code = typeof errorBody.code === "string" ? errorBody.code : undefined;
      throw new ApiError(res.status, message, type, requestId, errorBody.errors, undefined, code);
    }
  }

  return { status: res.status, body: parsed, headers: res.headers };
}

export const tsrClient = initTsrReactQuery(rootContract, {
  baseUrl: typeof window !== "undefined" ? window.location.origin : "",
  api: tsrApiFetcher,
});

/**
 * Per-domain typed ts-rest react-query accessors.
 *
 * WHY: `initTsrReactQuery` over the full 22-domain root contract trips TS's
 * union-instantiation depth limit — property chains like
 * `tsrClient.students.list` degrade to non-callable unions, which led to
 * `@ts-expect-error - TS union discrimination limit` being suppressed at every
 * hook across all modules (~286 sites), erasing query-param and response
 * types exactly where the contract layer was supposed to enforce them.
 *
 * `tsr.students` instantiates `TsRestReactQueryHooksContainer` against the
 * small per-domain contract (`studentContract`), which TS resolves fully:
 * real query/mutation request and response types at every call site. The
 * single cast per domain lives here in this reviewed file; feature code uses
 * `tsr.<domain>.<route>.useQuery/useMutation` — not `tsrClient`.
 */
type TsrClientArgs = Parameters<typeof initTsrReactQuery>[1];
type DomainTsr<C extends AppRouter> = TsRestReactQueryHooksContainer<C, TsrClientArgs>;

export const tsr = {
  students: tsrClient.students as unknown as DomainTsr<typeof studentContract>,
  finance: tsrClient.finance as unknown as DomainTsr<typeof financeContract>,
  attendance: tsrClient.attendance as unknown as DomainTsr<typeof attendanceContract>,
  contacts: tsrClient.contacts as unknown as DomainTsr<typeof contactsContract>,
  faculty: tsrClient.faculty as unknown as DomainTsr<typeof facultyContract>,
  users: tsrClient.users as unknown as DomainTsr<typeof userContract>,
  messaging: tsrClient.messaging as unknown as DomainTsr<typeof messagingContract>,
  sessions: tsrClient.sessions as unknown as DomainTsr<typeof sessionContract>,
  questionBank: tsrClient.questionBank as unknown as DomainTsr<typeof questionBankContract>,
  accounting: tsrClient.accounting as unknown as DomainTsr<typeof accountingContract>,
  hasanat: tsrClient.hasanat as unknown as DomainTsr<typeof hasanatContract>,
  obligations: tsrClient.obligations as unknown as DomainTsr<typeof obligationContract>,
  examinations: tsrClient.examinations as unknown as DomainTsr<typeof examinationContract>,
  enrollments: tsrClient.enrollments as unknown as DomainTsr<typeof enrollmentContract>,
  dashboard: tsrClient.dashboard as unknown as DomainTsr<typeof dashboardContract>,
  savedReports: tsrClient.savedReports as unknown as DomainTsr<typeof savedReportsContract>,
  workspace: tsrClient.workspace as unknown as DomainTsr<typeof workspaceContract>,
  auth: tsrClient.auth as unknown as DomainTsr<typeof authContract>,
  profile: tsrClient.profile as unknown as DomainTsr<typeof profileContract>,
  public: tsrClient.public as unknown as DomainTsr<typeof publicContract>,
  ai: tsrClient.ai as unknown as DomainTsr<typeof aiContract>,
  platform: tsrClient.platform as unknown as DomainTsr<typeof platformContract>,
};

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
