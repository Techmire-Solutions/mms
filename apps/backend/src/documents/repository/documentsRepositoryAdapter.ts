import type { DocumentTemplate } from "@mms/shared";
import {
  deleteDocumentTemplateRepo,
  getDocumentTemplateRepo,
  listDocumentTemplatesRepo,
  upsertDocumentTemplateRepo,
  type StoredDocumentTemplate,
} from "../../db/repositories/documentTemplatesRepository.js";

export type { StoredDocumentTemplate };

export interface DocumentTemplatesStoragePort {
  getTemplate(tenant: string, key: string): Promise<StoredDocumentTemplate | null>;
  /** Compare-and-set on `updated_at`; `null` means the caller read no stored layout. */
  saveTemplate(
    tenant: string,
    key: string,
    template: DocumentTemplate,
    expectedUpdatedAt: Date | null,
  ): Promise<StoredDocumentTemplate | null>;
  deleteTemplate(tenant: string, key: string): Promise<boolean>;
  listTemplates(
    tenant: string,
  ): Promise<Array<{ key: string; template: DocumentTemplate; updatedAt: Date }>>;
}

export const documentsRepositoryAdapter: DocumentTemplatesStoragePort = {
  getTemplate: getDocumentTemplateRepo,
  saveTemplate: upsertDocumentTemplateRepo,
  deleteTemplate: deleteDocumentTemplateRepo,
  listTemplates: listDocumentTemplatesRepo,
};
