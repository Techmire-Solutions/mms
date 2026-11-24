/** VCF export orchestration moved to the Contacts use-case layer; kept as a stable public path. */
export {
  buildContactsVcfExport,
  generateContactsVcfStreamChunks,
} from "../use-cases/contactExportUseCases.js";
