import { sql, type SQL } from "drizzle-orm";
import { contacts, contactPhones, contactEmails, contactAddresses } from "../schema.js";

/** Primary dialable phone digits: contact_phones (isPrimary first) then scalar phone. */
export function primaryPhoneDigitsSql(): SQL {
  return sql`(
      SELECT regexp_replace(
        CASE
          WHEN NULLIF(trim(p.number), '') LIKE '+%'
            THEN trim(p.number)
          ELSE concat_ws(
            '',
            NULLIF(trim(p.country_code), ''),
            NULLIF(trim(p.number), '')
          )
        END,
        '[^0-9]',
        '',
        'g'
      )
      FROM ${contactPhones} p
      WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND p.contact_id = ${contacts.id}
        AND NULLIF(trim(p.number), '') IS NOT NULL
      ORDER BY CASE WHEN p.is_primary THEN 0 ELSE 1 END, p.sort_order ASC
      LIMIT 1
  )`;
}

/** True when contact has a non-empty primary/legacy phone number. */
export function hasPhoneSql(): SQL {
  return sql`(
    EXISTS (
      SELECT 1
      FROM ${contactPhones} p
      WHERE p.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND p.contact_id = ${contacts.id}
        AND NULLIF(trim(p.number), '') IS NOT NULL
    )
  )`;
}

/** True when contact has a non-empty primary/legacy email. */
export function hasEmailSql(): SQL {
  return sql`(
    EXISTS (
      SELECT 1
      FROM ${contactEmails} e
      WHERE e.workspace_subdomain = ${contacts.workspaceSubdomain}
        AND e.contact_id = ${contacts.id}
        AND NULLIF(trim(e.address), '') IS NOT NULL
    )
  )`;
}

/**
 * WhatsApp eligibility approx: dialable digit length 8–15 on primary phone
 * (aligns with PuppeteerWhatsAppProvider.getNumberId bounds).
 */
export function hasWhatsAppSql(): SQL {
  return sql`(length(${primaryPhoneDigitsSql()}) BETWEEN 8 AND 15)`;
}

/**
 * Non-empty value for a field key on typed contacts table.
 */
export function contactFieldNonEmptySql(fieldKey: string): SQL {
  switch (fieldKey) {
    case "firstName":
      return sql`NULLIF(trim(${contacts.firstName}), '') IS NOT NULL`;
    case "lastName":
      return sql`NULLIF(trim(${contacts.lastName}), '') IS NOT NULL`;
    case "name":
      return sql`NULLIF(trim(${contacts.name}), '') IS NOT NULL`;
    case "gender":
      return sql`NULLIF(trim(${contacts.gender}), '') IS NOT NULL`;
    case "dob":
      return sql`${contacts.dob} IS NOT NULL`;
    case "cnic":
      return sql`NULLIF(trim(${contacts.cnic}), '') IS NOT NULL`;
    case "isSyed":
      return sql`${contacts.isSyed} IS TRUE`;
    case "avatar":
      return sql`NULLIF(trim(${contacts.avatar}), '') IS NOT NULL`;
    case "notes":
      return sql`NULLIF(trim(${contacts.notes}), '') IS NOT NULL`;
    case "phone":
    case "phones":
      return hasPhoneSql();
    case "email":
    case "emails":
      return hasEmailSql();
    case "address":
    case "addresses":
    case "line1":
      return sql`EXISTS (SELECT 1 FROM ${contactAddresses} a WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain} AND a.contact_id = ${contacts.id} AND NULLIF(trim(a.line1), '') IS NOT NULL)`;
    case "city":
      return sql`EXISTS (SELECT 1 FROM ${contactAddresses} a WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain} AND a.contact_id = ${contacts.id} AND NULLIF(trim(a.city), '') IS NOT NULL)`;
    case "state":
      return sql`EXISTS (SELECT 1 FROM ${contactAddresses} a WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain} AND a.contact_id = ${contacts.id} AND NULLIF(trim(a.state), '') IS NOT NULL)`;
    case "country":
      return sql`EXISTS (SELECT 1 FROM ${contactAddresses} a WHERE a.workspace_subdomain = ${contacts.workspaceSubdomain} AND a.contact_id = ${contacts.id} AND NULLIF(trim(a.country), '') IS NOT NULL)`;
    default:
      return sql`true`;
  }
}
