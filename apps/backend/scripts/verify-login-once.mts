try {
  process.loadEnvFile();
} catch {}
import pg from "pg";
import { verifyPassword } from "../src/services/auth/passwordService.js";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const result = await client.query<{
  login_email: string;
  role: string;
  password_hash: string;
  must_change_password: boolean;
}>(
  "SELECT login_email, role, password_hash, must_change_password FROM tenant_users WHERE workspace_subdomain=$1",
  ["dq"],
);

for (const row of result.rows) {
  const ok = await verifyPassword(process.env.LOGIN_PW ?? "", row.password_hash);
  console.log(
    `${(row.login_email || "(no email)").padEnd(24)} role=${row.role.padEnd(18)} loginWorks=${ok} mustChangePassword=${row.must_change_password}`,
  );
}

await client.end();
