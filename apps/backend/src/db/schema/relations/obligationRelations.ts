import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import {
  obligationTypes,
  mujtahids,
  mujtahidReps,
  wakalaTypes,
  obligationDistributions,
  obligationCollections,
} from "../obligations.js";

export const obligationTypesRelations = relations(obligationTypes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [obligationTypes.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  wakalaTypes: many(wakalaTypes),
  collections: many(obligationCollections),
}));

export const mujtahidsRelations = relations(mujtahids, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [mujtahids.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  reps: many(mujtahidReps),
}));

export const mujtahidRepsRelations = relations(mujtahidReps, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [mujtahidReps.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  mujtahid: one(mujtahids, {
    fields: [mujtahidReps.workspaceSubdomain, mujtahidReps.mujtahidId],
    references: [mujtahids.workspaceSubdomain, mujtahids.id],
  }),
  wakalaTypes: many(wakalaTypes),
  collections: many(obligationCollections),
}));

export const wakalaTypesRelations = relations(wakalaTypes, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [wakalaTypes.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  rep: one(mujtahidReps, {
    fields: [wakalaTypes.workspaceSubdomain, wakalaTypes.mujtahidRepresentativeId],
    references: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
  }),
  obligationType: one(obligationTypes, {
    fields: [wakalaTypes.workspaceSubdomain, wakalaTypes.obligationTypeId],
    references: [obligationTypes.workspaceSubdomain, obligationTypes.id],
  }),
  distributions: many(obligationDistributions),
}));

export const obligationDistributionsRelations = relations(obligationDistributions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [obligationDistributions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  wakalaType: one(wakalaTypes, {
    fields: [obligationDistributions.workspaceSubdomain, obligationDistributions.wakalaTypeId],
    references: [wakalaTypes.workspaceSubdomain, wakalaTypes.id],
  }),
}));

export const obligationCollectionsRelations = relations(obligationCollections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [obligationCollections.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  obligationType: one(obligationTypes, {
    fields: [obligationCollections.workspaceSubdomain, obligationCollections.obligationTypeId],
    references: [obligationTypes.workspaceSubdomain, obligationTypes.id],
  }),
  rep: one(mujtahidReps, {
    fields: [
      obligationCollections.workspaceSubdomain,
      obligationCollections.mujtahidRepresentativeId,
    ],
    references: [mujtahidReps.workspaceSubdomain, mujtahidReps.id],
  }),
}));
