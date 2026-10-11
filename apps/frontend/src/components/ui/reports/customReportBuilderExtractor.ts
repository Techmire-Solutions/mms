import { compileContactReportCellExtractor, isContactsReportFieldId } from "@mms/shared";
import type { DataSource } from "./customReportBuilderFields";

export function toCamelCase(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9 ]/g, "");
  return cleaned
    .split(" ")
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

export interface PreviewFieldExtractor {
  label: string;
  extract: (sourceRow: Record<string, unknown>) => string | number;
}

export function compilePreviewFieldExtractor(
  selectedField: string,
  source: DataSource,
  cellLabels: { yes: string; no: string },
  currencyCode: string,
  resolveFieldLabel: (field: string) => string,
): PreviewFieldExtractor {
  const label = resolveFieldLabel(selectedField);

  if (source === "contacts" && isContactsReportFieldId(selectedField)) {
    const contactExtractor = compileContactReportCellExtractor(selectedField, cellLabels);
    return {
      label,
      extract: contactExtractor,
    };
  }

  if (
    selectedField === "Name" ||
    selectedField === "Student Name" ||
    selectedField === "Faculty Name" ||
    selectedField === "Faculty"
  ) {
    return {
      label,
      extract: (sourceRow) =>
        String(
          sourceRow.name ||
            sourceRow.studentName ||
            sourceRow.facultyName ||
            sourceRow.faculty ||
            "—",
        ),
    };
  }
  if (selectedField === "Status") {
    return {
      label,
      extract: (sourceRow) => String(sourceRow.status || "—"),
    };
  }
  if (selectedField === "Class") {
    return {
      label,
      extract: (sourceRow) =>
        String(
          sourceRow.class ||
            sourceRow.className ||
            (sourceRow.classes as { name: string }[] | undefined)?.[0]?.name ||
            "—",
        ),
    };
  }
  if (selectedField === "Session") {
    return {
      label,
      extract: (sourceRow) => String(sourceRow.session || "—"),
    };
  }
  if (selectedField === "Room") {
    return {
      label,
      extract: (sourceRow) => String(sourceRow.room || "—"),
    };
  }
  if (selectedField === "Time") {
    return {
      label,
      extract: (sourceRow) => String(sourceRow.time || "—"),
    };
  }
  if (selectedField === "Days") {
    return {
      label,
      extract: (sourceRow) =>
        Array.isArray(sourceRow.days) ? sourceRow.days.join(", ") : String(sourceRow.days || "—"),
    };
  }
  if (selectedField === "Discount Type") {
    return {
      label,
      extract: (sourceRow) => String(sourceRow.discountType || "None"),
    };
  }
  if (selectedField === "Discount %" || selectedField === "Discount") {
    return {
      label,
      extract: (sourceRow) =>
        sourceRow.discountPct !== undefined
          ? `${sourceRow.discountPct}%`
          : sourceRow.discountAmt
            ? `${currencyCode} ${sourceRow.discountAmt}`
            : "0",
    };
  }
  if (selectedField === "Final Amount") {
    return {
      label,
      extract: (sourceRow) => (sourceRow.finalAmt ? `${currencyCode} ${sourceRow.finalAmt}` : "0"),
    };
  }
  if (selectedField === "Utilisation %" || selectedField === "Rate %") {
    return {
      label,
      extract: (sourceRow) =>
        Number(sourceRow.capacity || 0) > 0
          ? `${Math.round((Number(sourceRow.enrolled || 0) / Number(sourceRow.capacity || 1)) * 100)}%`
          : sourceRow.rate
            ? `${sourceRow.rate}%`
            : "100%",
    };
  }
  if (
    selectedField === "Registration Date" ||
    selectedField === "Issued Date" ||
    selectedField === "Due Date" ||
    selectedField === "Date" ||
    selectedField === "Last Marked" ||
    selectedField === "Last Awarded"
  ) {
    return {
      label,
      extract: (sourceRow) =>
        String(
          sourceRow.registeredDate ||
            sourceRow.issuedDate ||
            sourceRow.dueDate ||
            sourceRow.date ||
            sourceRow.lastMarked ||
            sourceRow.lastAwarded ||
            "—",
        ),
    };
  }

  const camel = toCamelCase(selectedField);
  const fallbackKey = selectedField.toLowerCase().replace(/ /g, "");
  return {
    label,
    extract: (sourceRow) => {
      const rawValue = sourceRow[camel] !== undefined ? sourceRow[camel] : sourceRow[fallbackKey];
      return rawValue !== undefined ? String(rawValue) : "—";
    },
  };
}
