import { toTitleCase } from "./titleCaseStringUtils.js";

const SYSTEM_EXCLUDED_KEYS = new Set([
  "id",
  "key",
  "uuid",
  "code",
  "token",
  "password",
  "hash",
  "salt",
  "email",
  "phone",
  "avatar",
  "url",
  "status",
  "role",
  "type",
  "category",
  "dob",
  "date",
  "createdat",
  "updatedat",
  "deletedat",
  "deletedby",
  "deletionreason",
  "rating",
  "aisummary",
  "attachment",
  "attachments",
  "file",
  "path",
  "subdomain",
  "domain",
  "host",
  "hostname",
  "ip",
  "logo",
  "logourl",
  "color",
  "theme",
  "icon",
  "uri",
  "username",
  "scope",
  "permissions",
  "gender",
  "currency",
  "enabledmodules",
  "columnpreferences",
  "preferences",
  "profilejson",
  "customdata",
  "data",
  "avatarcolors",
  "cornerstyle",
  "primarycolor",
  "accentcolor",
  "sidebartheme",
  "clientsecret",
  "refreshtoken",
  "accesstoken",
  "authchallenge",
  "authartifacts",
  "language",
  "locale",
  "timezone",
  "ipaddress",
  "useragent",
  "sessionid",
  "sessiontoken",
  "signature",
  "checksum",
]);

function isKeyIgnored(k?: string): boolean {
  if (!k) return false;
  const lk = k.toLowerCase();
  return (
    SYSTEM_EXCLUDED_KEYS.has(lk) ||
    lk.endsWith("id") ||
    lk.startsWith("_") ||
    lk.includes("hash") ||
    lk.includes("password") ||
    lk.includes("salt") ||
    lk.includes("key")
  );
}

/**
 * Recursively applies Title Case to eligible string fields in any object/array.
 */
export function applyTitleCaseRecursive(data: unknown, key?: string): unknown {
  if (typeof data === "string") {
    if (isKeyIgnored(key)) {
      return data;
    }
    const trimmed = data.trim();
    if (
      trimmed === "" ||
      trimmed.includes("@") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:") ||
      /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ||
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        trimmed,
      ) ||
      (/^[a-fA-F0-9]+$/.test(trimmed) && trimmed.length > 20) ||
      (/^[\d\s+\-()]+$/.test(trimmed) && trimmed.replace(/[\s+\-()]/g, "").length >= 7)
    ) {
      return data;
    }
    return toTitleCase(data) as string;
  }

  if (Array.isArray(data)) {
    return data.map((item) => applyTitleCaseRecursive(item, key));
  }

  if (data !== null && typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      result[k] = applyTitleCaseRecursive(v, k);
    }
    return result;
  }

  return data;
}

/**

 * Formats specified text fields in a contact object to Title Case.
 * @param contact - The contact object.
 * @returns A new contact object with title-cased fields.
 */
export function applyTitleCaseToContact<T extends Record<string, unknown>>(contact: T): T {
  const result = { ...contact } as Record<string, unknown>;

  const directFields = [
    "firstName",
    "lastName",
    "name",
    "preferredName",
    "fatherName",
    "grandfatherName",
    "familyName",
    "nationality",
    "religion",
    "ethnicity",
    "languages",
    "employer",
    "industry",
    "designation",
    "relationship",
  ];

  directFields.forEach((field) => {
    const value = result[field];
    if (typeof value === "string") {
      result[field] = toTitleCase(value) as string;
    }
  });

  if (Array.isArray(result.phones)) {
    result.phones = result.phones.map((phone: Record<string, unknown>) => ({
      ...phone,
      label: typeof phone.label === "string" ? (toTitleCase(phone.label) as string) : phone.label,
    }));
  }

  if (Array.isArray(result.emails)) {
    result.emails = result.emails.map((email: Record<string, unknown>) => ({
      ...email,
      label: typeof email.label === "string" ? (toTitleCase(email.label) as string) : email.label,
    }));
  }

  if (Array.isArray(result.addresses)) {
    result.addresses = result.addresses.map((address: Record<string, unknown>) => ({
      ...address,
      line1:
        typeof address.line1 === "string" ? (toTitleCase(address.line1) as string) : address.line1,
      city: typeof address.city === "string" ? (toTitleCase(address.city) as string) : address.city,
      state:
        typeof address.state === "string" ? (toTitleCase(address.state) as string) : address.state,
      country:
        typeof address.country === "string"
          ? (toTitleCase(address.country) as string)
          : address.country,
      label:
        typeof address.label === "string" ? (toTitleCase(address.label) as string) : address.label,
    }));
  }

  if (Array.isArray(result.socials)) {
    result.socials = result.socials.map((social: Record<string, unknown>) => ({
      ...social,
      platform:
        typeof social.platform === "string"
          ? (toTitleCase(social.platform) as string)
          : social.platform,
    }));
  }

  if (Array.isArray(result.relationshipContacts)) {
    result.relationshipContacts = result.relationshipContacts.map(
      (link: Record<string, unknown>) => ({
        ...link,
        name: typeof link.name === "string" ? (toTitleCase(link.name) as string) : link.name,
        relationship:
          typeof link.relationship === "string"
            ? (toTitleCase(link.relationship) as string)
            : link.relationship,
      }),
    );
  }

  if (Array.isArray(result.relationships)) {
    result.relationships = result.relationships.map((relationship: Record<string, unknown>) => ({
      ...relationship,
      relationship:
        typeof relationship.relationship === "string"
          ? (toTitleCase(relationship.relationship) as string)
          : relationship.relationship,
    }));
  }

  const excludedKeys = new Set([
    "id",
    "avatar",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "deletedBy",
    "deletionReason",
    "dob",
    "rating",
    "aiSummary",
    "email",
    "phone",
    "phones",
    "emails",
    "addresses",
    "socials",
    "relationshipContacts",
    "relationships",
    "activities",
    "attachments",
  ]);

  Object.keys(result).forEach((key) => {
    if (!excludedKeys.has(key)) {
      const value = result[key];
      if (typeof value === "string") {
        if (
          !value.includes("@") &&
          !value.startsWith("http://") &&
          !value.startsWith("https://") &&
          !/^\d{4}-\d{2}-\d{2}$/.test(value) &&
          !value.startsWith("data:")
        ) {
          result[key] = toTitleCase(value) as string;
        }
      }
    }
  });

  return result as T;
}
