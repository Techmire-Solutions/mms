/**
 * Registers the document store's repository importer.
 *
 * The closure lives in this app module so the mapping's app-relative specifiers
 * (`./repositories/<name>.js`) resolve against `apps/api/src/db/` under Node
 * and Vitest. Every app doc-store entry point imports this module, so the port is
 * configured before any relational mirror runs (docs/monorepo-migration-plan.md U23).
 */
import { configureDocumentStoreRepositoryLoader } from "@mms/be-core/db-sync/documentStoreRepositoryLoader";

configureDocumentStoreRepositoryLoader((specifier) => import(specifier));
