import type { Permission } from "../auth/permissions.js";
import { DEFAULT_SETTINGS_SUB_TABS } from "./contactTypes.js";
import { WHATSAPP_STATUS_VALUES } from "./contactEntityTypes.js";
import { z } from "zod";
import {
  activitySchema,
  attachmentSchema,
  addressSchema,
  contactEducationSchema,
  contactExperienceSchema,
  contactSkillSchema,
  contactBankDetailSchema,
  emailAddressSchema,
  phoneNumberSchema,
  relationshipContactSchema,
  relationshipSchema,
  socialLinkSchema,
} from "./contactNestedSchemas.js";
export {
  activitySchema,
  attachmentSchema,
  addressSchema,
  contactEducationSchema,
  contactExperienceSchema,
  contactSkillSchema,
  contactBankDetailSchema,
  emailAddressSchema,
  phoneNumberSchema,
  relationshipContactSchema,
  relationshipSchema,
  socialLinkSchema,
} from "./contactNestedSchemas.js";

export {
  collectContactWriteExtraFieldKeys,
  buildContactWriteSchema,
  contactWriteSchema,
} from "../schemas/contacts.dto.js";

export const contactRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    name: z.string().optional(),
    gender: z.string().optional(),
    dob: z.string().optional(),
    cnic: z.string().optional(),
    isSyed: z.boolean().optional(),
    avatar: z.union([z.string(), z.null()]).optional(),
    tag: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    aiSummary: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().optional(),
    deletedBy: z.string().optional(),
    deletionReason: z.string().optional(),
    whatsappStatus: z.enum(WHATSAPP_STATUS_VALUES).optional(),
    lastCheckedAt: z.string().nullable().optional(),
    phones: z.array(phoneNumberSchema).optional(),
    emails: z.array(emailAddressSchema).optional(),
    addresses: z.array(addressSchema).optional(),
    socials: z.array(socialLinkSchema).optional(),
    education: z.array(contactEducationSchema).optional(),
    experience: z.array(contactExperienceSchema).optional(),
    skills: z.array(contactSkillSchema).optional(),
    bankDetails: z.array(contactBankDetailSchema).optional(),
    relationshipContacts: z.array(relationshipContactSchema).optional(),
    /** @deprecated Legacy JSON key — hydrated into relationshipContacts on read/write. */
    emergencyContacts: z.array(relationshipContactSchema).optional(),
    relationships: z.array(relationshipSchema).optional(),
    activities: z.array(activitySchema).optional(),
    attachments: z.array(attachmentSchema).optional(),
  })
  .passthrough();

export const contactListSchema = z.array(contactRecordSchema);

/**
 * Contacts module manifest — single source of truth for tiers, permissions,
 * Work directory views, soft-delete policy, and Setup sub-tabs.
 */
export const CONTACTS_MODULE_MANIFEST = {
  moduleId: "contacts",
  entityType: "Contact",
  collectionKey: "contacts",
  configObjectKey: "contact_field_config",
  preferencesObjectKey: "contact_preferences",
  columnPreferencesObjectKey: "contact_user_column_preferences",
  restBasePath: "/api/contacts",
  analyticsCategory: "contacts",
  tiers: ["work", "reports", "setup"] as const,
  permissions: {
    read: "contacts.read",
    write: "contacts.write",
    delete: "contacts.delete",
    setupView: "configuration.view",
    setupWrite: "settings.global.write",
    export: "contacts.read",
    reports: "contacts.read",
  } satisfies Record<string, Permission>,
  work: {
    directoryViews: ["table", "cards"] as const,
    bulkActions: ["whatsapp", "sms", "email", "export", "delete"] as const,
    integrityTools: ["duplicates"] as const,
  },
  setupSubTabs: DEFAULT_SETTINGS_SUB_TABS.slice()
    .sort((left, right) => left.order - right.order)
    .map((tab) => tab.key) as ["preferences", "sync"],
  defaultExportFilename: "contacts.csv",
  heroFieldKeys: ["avatar", "firstName", "lastName", "dob", "gender", "isSyed"] as const,
  searchableFieldKeys: ["name", "firstName", "lastName", "phone", "email", "city"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    /** Active Work/server CSV exports exclude trash; Work trash UI omits export CTAs. */
    exportsIncludeDeleted: false,
    duplicatesIncludeDeleted: false,
    captureDeletionReason: true,
    retentionDays: null,
  },
  /** Server CSV export page-walk size (rows per streamed chunk). */
  exportChunkSize: 100,
  /** Default Work directory page size when using server pagination. */
  defaultPageSize: 50,
  maxPageSize: 100,
  /** Contact count above which duplicate scan runs as a background job. */
  duplicateScanAsyncMinContacts: 500,
} as const;
