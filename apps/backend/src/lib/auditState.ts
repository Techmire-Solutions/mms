export * from "@mms/be-core/audit";

// Tests routinely mock the `@mms/be-core/audit` entry to stub the recorder.
// The pure action mapper is also a domain-write dependency, so resolve it from
// its own subpath: mocking the recorder must not make audit writes throw.
export { mapActionStringToAuditType, sanitizeAuditState } from "@mms/be-core/audit/auditState";
