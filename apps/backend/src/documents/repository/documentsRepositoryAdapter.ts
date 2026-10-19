import type { DocumentTemplate } from "@mms/shared";
import {
  deleteDocumentTemplateRepo,
  getDocumentTemplateRepo,
  listDocumentTemplatesRepo,
  upsertDocumentTemplateRepo,
} from "../../db/repositories/documentTemplatesRepository.js";

export interface DocumentTemplatesStoragePort {
  getTemplate(tenant: string, key: string): Promise<DocumentTemplate | null>;
  saveTemplate(tenant: string, key: string, template: DocumentTemplate): Promise<DocumentTemplate>;
  deleteTemplate(tenant: string, key: string): Promise<boolean>;
  listTemplates(tenant: string): Promise<Array<{ key: string; template: DocumentTemplate; updatedAt: Date }>>;
}

export const documentsRepositoryAdapter: DocumentTemplatesStoragePort = {
  getTemplate: getDocumentTemplateRepo,
  saveTemplate: upsertDocumentTemplateRepo,
  deleteTemplate: deleteDocumentTemplateRepo,
  listTemplates: listDocumentTemplatesRepo,
};
