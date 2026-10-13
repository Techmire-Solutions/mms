/**
 * Finance/accounting ERD domains.
 *
 * Stable barrel: the domains were split into one module each to stay under the
 * 300-line ceiling; consumers keep importing from this path.
 */
export * from "./erdDomainAccounting.js";
export * from "./erdDomainFinance.js";
