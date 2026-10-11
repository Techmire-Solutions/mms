import type { FastifyRequest } from "fastify";
import type { User } from "@mms/shared";
import type { z } from "zod";

/**
 * Typed request args for a ts-rest contract route handler.
 *
 * ts-rest's `ServerInferRequest` normally infers these from the contract, but
 * the large per-domain contracts (e.g. `financeContract`) exceed TS's
 * union-instantiation depth limit, so both `s.router(contract, ...)` and
 * `ServerInferRequest<...>` degrade the handler args to `any`/never.
 *
 * Extracting the request types via `z.infer` on each route's schema properties
 * avoids that depth blowup and restores full request-side type safety
 * (params / query / body) without restructuring the contracts.
 */
export type ContractRouteArgs<T> = {
  params: T extends { pathParams: infer PP }
    ? PP extends z.ZodTypeAny
      ? z.infer<PP>
      : Record<string, string>
    : T extends { params: infer P }
      ? P extends z.ZodTypeAny
        ? z.infer<P>
        : Record<string, string>
      : Record<string, string>;
  query: T extends { query: infer Q }
    ? Q extends z.ZodTypeAny
      ? z.infer<Q>
      : Record<string, string>
    : Record<string, string>;
  body: T extends { body: infer B } ? (B extends z.ZodTypeAny ? z.infer<B> : unknown) : unknown;
  headers: T extends { headers: infer H }
    ? H extends z.ZodTypeAny
      ? z.infer<H>
      : Record<string, string>
    : Record<string, string>;
  request: FastifyRequest & { user?: User; tenant?: { id: string } };
};

/**
 * Extracts the discriminated response union `{ status, body }` for a contract route.
 * Evaluated per-endpoint to avoid TS union-depth limits on monolithic contracts.
 */
export type ContractRouteResponse<T> = T extends { responses: infer R }
  ? {
      [K in keyof R]: {
        status: K extends `${infer N extends number}` ? N : K extends number ? K : never;
        body: R[K] extends z.ZodTypeAny ? z.infer<R[K]> : unknown;
      };
    }[keyof R]
  : { status: number; body: unknown };

/**
 * Type-safe contract route handler definition enforcing strictly typed request & response.
 */
export type ContractRouteHandler<T> = (
  args: ContractRouteArgs<T>,
) => Promise<ContractRouteResponse<T>>;
