/**
 * Client entry (`@mms/db/client`): connection pool, root/tenant db handles,
 * transactions, prepared statements and the runtime role guard.
 */
export * from "./dbClient.js";
export * from "./dbConnection.js";
export * from "./rlsRoleGuard.js";
export * from "./commitScope.js";
