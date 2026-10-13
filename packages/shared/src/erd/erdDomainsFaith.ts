import type { ErdDomain } from "./erdCatalogTypes.js";

/** Reward denominations, batches, and redemptions (Drizzle `hasanat.ts`). */
export const ERD_DOMAIN_HASANAT: ErdDomain = {
  id: "hasanat",
  labelKey: "nav.hasanatCards",
  tables: [
    {
      name: "hasanat_denoms",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(120)", kind: "column" },
        { name: "points", type: "integer", kind: "column" },
      ],
    },
    {
      name: "hasanat_batches",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "denomination_id", type: "text", kind: "fk" },
        { name: "quantity", type: "integer", kind: "column" },
      ],
    },
    {
      name: "hasanat_distributions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "batch_id", type: "text", kind: "fk" },
        { name: "denomination_id", type: "text", kind: "fk" },
        { name: "recipient_student_id", type: "varchar(64)", kind: "fk" },
        { name: "recipient_faculty_id", type: "varchar(64)", kind: "fk" },
      ],
    },
    {
      name: "hasanat_redemptions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "distribution_id", type: "text", kind: "fk" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "hasanat_batches",
      fromColumn: "denomination_id",
      toTable: "hasanat_denoms",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "hasanat_distributions",
      fromColumn: "batch_id",
      toTable: "hasanat_batches",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "hasanat_distributions",
      fromColumn: "denomination_id",
      toTable: "hasanat_denoms",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "hasanat_redemptions",
      fromColumn: "distribution_id",
      toTable: "hasanat_distributions",
      toColumn: "id",
      cardinality: "N:1",
    },
  ],
};

/** Wakala types, mujtahids, and collections (Drizzle `obligations.ts`). */
export const ERD_DOMAIN_OBLIGATIONS: ErdDomain = {
  id: "obligations",
  labelKey: "nav.obligations",
  tables: [
    {
      name: "obligation_types",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
      ],
    },
    {
      name: "mujtahids",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(255)", kind: "column" },
      ],
    },
    {
      name: "mujtahid_reps",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "mujtahid_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "wakala_types",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "mujtahid_representative_id", type: "text", kind: "fk" },
        { name: "obligation_type_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "obligation_distributions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "wakala_type_id", type: "text", kind: "fk" },
        { name: "percentage", type: "numeric(5,2)", kind: "column" },
      ],
    },
    {
      name: "obligation_collections",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "obligation_type_id", type: "text", kind: "fk" },
        { name: "mujtahid_representative_id", type: "text", kind: "fk" },
        { name: "amount", type: "numeric(12,2)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "mujtahid_reps",
      fromColumn: "mujtahid_id",
      toTable: "mujtahids",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "wakala_types",
      fromColumn: "mujtahid_representative_id",
      toTable: "mujtahid_reps",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "wakala_types",
      fromColumn: "obligation_type_id",
      toTable: "obligation_types",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "obligation_distributions",
      fromColumn: "wakala_type_id",
      toTable: "wakala_types",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "obligation_collections",
      fromColumn: "obligation_type_id",
      toTable: "obligation_types",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "obligation_collections",
      fromColumn: "mujtahid_representative_id",
      toTable: "mujtahid_reps",
      toColumn: "id",
      cardinality: "N:1",
    },
  ],
};
