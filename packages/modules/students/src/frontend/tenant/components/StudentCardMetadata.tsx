import type { ModuleColumnRegistryEntry, Student } from "@mms/contracts";
import { DirectoryCardMetadata } from "@mms/fe-core/components/DirectoryCardMetadata";
import type { StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { useTranslation } from "@mms/fe-core/i18n";
import { getStudentVisibleWorkColumns } from "../lib/studentsListVisibleColumns";
import { renderStudentWorkColumnValue } from "./studentWorkColumnCell";

export interface StudentCardMetadataProps {
  student: Student;
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
  isColumnVisible: (key: string) => boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  /** Optional entity descriptor — when provided, descriptor-driven fields supplement legacy column tiles. */
  descriptor?: EntityDescriptor<Student>;
}

const getColumnKey = (col: { key: string }) => col.key;
const getColumnLabel = (col: { label: string }) => col.label;

/** Students domain metadata tiles — face columns excluded (Contacts/Teachers parity). */
export function StudentCardMetadata({
  student,
  statusBadgeConfig,
  isColumnVisible,
  columnRegistry,
  descriptor,
}: StudentCardMetadataProps): React.JSX.Element | null {
  const { t } = useTranslation();

  const metaColumns = getStudentVisibleWorkColumns(columnRegistry, isColumnVisible, {
    excludeFace: true,
  });

  if (metaColumns.length === 0 && !descriptor) {
    return null;
  }

  const extraColumns =
    metaColumns.length > 0
      ? {
          columns: metaColumns,
          keyFor: getColumnKey,
          labelFor: getColumnLabel,
          renderValue: (col: ModuleColumnRegistryEntry) =>
            renderStudentWorkColumnValue(student, col.key, {
              t,
              statusBadgeConfig,
              emptyFallback: null,
            }),
        }
      : undefined;

  return (
    <DirectoryCardMetadata
      descriptor={descriptor}
      entity={student}
      isColumnVisible={isColumnVisible}
      extraColumns={extraColumns}
      columns={extraColumns?.columns}
      keyFor={extraColumns?.keyFor}
      labelFor={extraColumns?.labelFor}
      renderValue={extraColumns?.renderValue}
    />
  );
}
