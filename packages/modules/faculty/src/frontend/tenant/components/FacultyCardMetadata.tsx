import type { Faculty, FacultyCustomField, ModuleColumnRegistryEntry } from "@mms/contracts";
import { DirectoryCardMetadata } from "@mms/fe-core/components/DirectoryCardMetadata";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { useTranslation } from "@mms/fe-core/i18n";
import { getFacultyVisibleWorkColumns } from "../lib/facultyListVisibleColumns";
import { renderFacultyWorkColumnValue } from "./facultyWorkColumnCell";

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
    <DirectoryCardMetadata
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
