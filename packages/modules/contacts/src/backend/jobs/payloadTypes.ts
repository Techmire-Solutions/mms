export interface ContactsVcfExportJobPayload {
  filename?: string;
  label?: string;
  /**
   * Enqueue-time viewer role. The runner sanitizes each page before `toVCard`
   * (C-05); optional so jobs queued before this field existed still complete,
   * and an empty role still hides non-empty field permissions.
   */
  viewerRole?: string;
}
