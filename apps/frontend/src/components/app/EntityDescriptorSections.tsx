import React from "react";
import { DetailSectionCard } from "@/components/ui/DetailSectionCard";
import {
  DetailAttributeRow,
  type DetailAttributeRowVariant,
} from "@/components/ui/DetailAttributeRow";
import type { EntityDescriptor } from "@/types/entityRegistry";
import { getEntityDescriptor } from "@/components/common/entityRegistry";

export interface EntityDescriptorSectionsProps<T> {
  entity: T;
  entityType?: string;
  descriptor?: EntityDescriptor<T>;
  attributeVariant?: DetailAttributeRowVariant;
}

/**
 * Renders descriptor-driven detail sections inside a Drawer body.
 * SSOT for platform inspect drawers and any registry-backed detail body.
 */
export function EntityDescriptorSections<T>({
  entity,
  entityType,
  descriptor,
  attributeVariant = "card",
}: EntityDescriptorSectionsProps<T>): React.JSX.Element | null {
  const effectiveDescriptor =
    descriptor ??
    (entityType ? (getEntityDescriptor(entityType) as EntityDescriptor<T> | undefined) : undefined);

  if (!effectiveDescriptor) return null;

  return (
    <div className="space-y-6">
      {effectiveDescriptor.getDrawerSections().map((section) => (
        <DetailSectionCard
          key={section.id}
          title={section.title}
          className="divide-y divide-border/50 p-0"
        >
          {section.fields.map((field) => {
            const val = effectiveDescriptor.renderFieldValue(field.key, entity);
            return (
              <DetailAttributeRow
                key={field.key}
                label={field.label}
                value={val}
                icon={field.icon}
                variant={attributeVariant}
              />
            );
          })}
        </DetailSectionCard>
      ))}
    </div>
  );
}
