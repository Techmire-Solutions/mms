import { sql, type SQL } from "drizzle-orm";
import { contacts } from "../schema.js";

/** Digits-only phone comparison key (last 10 when >= 10) — `normalizePhoneForComparison`. */
export function phoneComparisonKeySql(numberExpr: SQL): SQL {
  return sql`CASE
    WHEN length(regexp_replace(trim(COALESCE(${numberExpr}, '')), '[^0-9]', '', 'g')) >= 10
      THEN right(regexp_replace(trim(COALESCE(${numberExpr}, '')), '[^0-9]', '', 'g'), 10)
    ELSE regexp_replace(trim(COALESCE(${numberExpr}, '')), '[^0-9]', '', 'g')
  END`;
}

/** Lower/trim email key — `normalizeEmail`. */
export function emailKeySql(addressExpr: SQL): SQL {
  return sql`lower(trim(COALESCE(${addressExpr}, '')))`;
}

/** Digits-only CNIC comparison key (13 digits) — `getContactCleanCnic`. */
export function cnicComparisonKeySql(cnicExpr: SQL): SQL {
  return sql`CASE
    WHEN length(regexp_replace(trim(COALESCE(${cnicExpr}, '')), '[^0-9]', '', 'g')) = 13
      THEN regexp_replace(trim(COALESCE(${cnicExpr}, '')), '[^0-9]', '', 'g')
    ELSE ''
  END`;
}

/** Lower/trim + prefix-strip (first match, like JS) + whitespace-collapse name key — `cleanName`. */
export function nameKeySql(prefixRegex: string): SQL {
  const nameExpr = sql`COALESCE(NULLIF(${contacts.name}, ''), ${contacts.firstName})`;
  const stripped = prefixRegex
    ? sql`regexp_replace(lower(trim(COALESCE(${nameExpr}, ''))), ${prefixRegex}, '')`
    : sql`lower(trim(COALESCE(${nameExpr}, '')))`;
  return sql`regexp_replace(${stripped}, '[[:space:]]+', '', 'g')`;
}
