import {
  SOCIAL_PLATFORMS,
  type SocialLink as ContactSocial,
  type RelationshipContact,
} from "./contactTypes.js";
import { SOCIAL_SYSTEM_KEYS, RELATIONSHIP_SYSTEM_KEYS } from "./contactItemNormalizeKeys.js";
import {
  retainExtraKeys,
  type ContactItemNormalizeDefaults,
} from "./contactItemNormalizeRowsShared.js";

/**
 * Normalizes a single Social link entry into a valid SocialLink object.
 */
export function normalizeSocialItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): ContactSocial {
  const defaultPlatform = defaults.socialPlatform || SOCIAL_PLATFORMS[0] || "Facebook";
  if (!item) return { platform: defaultPlatform, url: "" };
  if (typeof item === "string") {
    return { platform: defaultPlatform, url: item.trim() };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const url = String(obj.url || obj.link || obj.value || "").trim();
    const platform = String(obj.platform || obj.type || defaultPlatform).trim() || defaultPlatform;
    return { ...retainExtraKeys(obj, SOCIAL_SYSTEM_KEYS), platform, url };
  }
  return { platform: defaultPlatform, url: "" };
}

/**
 * Normalizes a single relationship-contact entry into a valid RelationshipContact object.
 */
export function normalizeRelationshipContactItem(
  item: unknown,
  defaults: ContactItemNormalizeDefaults = {},
): RelationshipContact {
  const defaultRelationship = defaults.relationship || "Parent";
  if (!item) return { relationship: defaultRelationship, contactId: "" };
  if (typeof item === "string" || typeof item === "number") {
    return { relationship: defaultRelationship, contactId: String(item) };
  }
  if (typeof item === "object") {
    const obj = item as Record<string, unknown>;
    const contactId = String(obj.contactId || obj.id || obj.targetId || "").trim();
    const relationship =
      String(obj.relationship || obj.relation || obj.type || defaultRelationship).trim() ||
      defaultRelationship;
    const name =
      typeof obj.name === "string" && obj.name.trim().length > 0 ? obj.name.trim() : undefined;
    const phone =
      typeof obj.phone === "string" && obj.phone.trim().length > 0 ? obj.phone.trim() : undefined;
    const inferred = typeof obj.inferred === "boolean" ? obj.inferred : undefined;
    const inferredFromContactId =
      obj.inferredFromContactId != null && String(obj.inferredFromContactId).trim().length > 0
        ? String(obj.inferredFromContactId).trim()
        : undefined;
    const inferenceDepth = typeof obj.inferenceDepth === "number" ? obj.inferenceDepth : undefined;

    return {
      ...retainExtraKeys(obj, RELATIONSHIP_SYSTEM_KEYS),
      relationship,
      contactId,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(inferred !== undefined ? { inferred } : {}),
      ...(inferredFromContactId ? { inferredFromContactId } : {}),
      ...(inferenceDepth !== undefined ? { inferenceDepth } : {}),
    };
  }
  return { relationship: defaultRelationship, contactId: "" };
}
