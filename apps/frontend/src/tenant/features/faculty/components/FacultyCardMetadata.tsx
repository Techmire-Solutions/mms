import type { Faculty, FacultyCustomField, ModuleColumnRegistryEntry } from "@mms/shared";
import { EntityCardMetadata } from "@/components/ui/EntityCardMetadata";
import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { EntityDescriptor } from "@/types/entityRegistry";
import { useTranslation } from "@/hooks/useTranslation";
import { getFacultyVisibleWorkColumns } from "@/tenant/features/faculty/components/facultyListVisibleColumns";
import { renderFacultyWorkColumnValue } from "@/tenant/features/faculty/components/facultyWorkColumnCell";

export interface FacultyCardMetadataProps {
  faculty: Faculty;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  customFieldsById: Map<string, FacultyCustomField>;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  /** Optional entity descriptor — descriptor-driven fields supplement legacy column tiles. */
  descriptor?: EntityDescriptor<Faculty>;
}

/** Faculty domain metadata tiles — Contacts/Students card metadata chrome. */
export function FacultyCardMetadata({
  faculty,
  isColumnVisible,
  columnRegistry,
  customFieldsById,
  statusConfig,
  descriptor,
}: FacultyCardMetadataProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const metaColumns = getFacultyVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: true,
  });

  if (metaColumns.length === 0 && !descriptor) {
    return null;
  }

  const extraColumns =
    metaColumns.length > 0
      ? {
          columns: metaColumns,
          keyFor: (col: ModuleColumnRegistryEntry) => col.key,
          labelFor: (col: ModuleColumnRegistryEntry) => col.label,
          renderValue: (col: ModuleColumnRegistryEntry) =>
            renderFacultyWorkColumnValue(faculty, col.key, {
              t,
              statusConfig,
              customFieldsById,
              emptyFallback: null,
            }),
        }
      : undefined;

  return (
    <EntityCardMetadata
      descriptor={descriptor}
      entity={faculty}
      isColumnVisible={isColumnVisible}
      extraColumns={extraColumns}
      columns={extraColumns?.columns}
      keyFor={extraColumns?.keyFor}
      labelFor={extraColumns?.labelFor}
      renderValue={extraColumns?.renderValue}
    />
  );
}
