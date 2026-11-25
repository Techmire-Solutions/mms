/**
 * App entry for `index:concurrent`.
 *
 * The index builder lives in `@mms/db/scripts/createIndexConcurrently`; this wrapper only
 * loads the app's env files (`apps/api/.env`, repo-root `.env`) and then runs it, so local DX
 * is unchanged. `packages/db` never parses `.env`.
 */
import { main } from "@mms/db/scripts/createIndexConcurrently";
import { loadBackendEnv } from "../config/loadEnv.js";

loadBackendEnv();
void main();
