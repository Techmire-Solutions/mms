import { describe, expect, it } from "vitest";
import { APP_TRANSLATIONS_EN } from "@mms/shared/translations/en";
import {
  FINANCE_AVAILABLE_FIELDS,
  FINANCE_PRESETS,
} from "@/tenant/features/finance/lib/financeTemplateData";
import {
  EXAMINATION_AVAILABLE_FIELDS,
  EXAMINATION_PRESETS,
} from "@/tenant/features/examinations/lib/examinationTemplateData";
import {
  HASANAT_AVAILABLE_FIELDS,
  HASANAT_PRESETS,
} from "@/tenant/features/hasanat/lib/hasanatTemplateData";
import { AVAILABLE_STUDENT_CARD_FIELDS } from "@/tenant/features/students/lib/studentCardTemplateStore";

const enKeys = new Set(Object.keys(APP_TRANSLATIONS_EN));

interface Surface {
  name: string;
  fields: ReadonlyArray<{ field: string }>;
  presets?: ReadonlyArray<{ key: string }>;
  keyForField: (field: string) => string;
  keyForPreset?: (presetKey: string) => string;
}

const surfaces: Surface[] = [
  {
    name: "finance",
    fields: FINANCE_AVAILABLE_FIELDS,
    presets: FINANCE_PRESETS,
    keyForField: (field) => `finance.templateField.${field}`,
    keyForPreset: (presetKey) => `finance.templatePreset.${presetKey}`,
  },
  {
    name: "examinations",
    fields: EXAMINATION_AVAILABLE_FIELDS,
    presets: EXAMINATION_PRESETS,
    keyForField: (field) => `examinations.templateField.${field}`,
    keyForPreset: (presetKey) => `examinations.templatePreset.${presetKey}`,
  },
  {
    name: "hasanat",
    fields: HASANAT_AVAILABLE_FIELDS,
    presets: HASANAT_PRESETS,
    keyForField: (field) => `hasanat.templateField.${field}`,
    keyForPreset: (presetKey) => `hasanat.templatePreset.${presetKey}`,
  },
  {
    name: "student-card",
    fields: AVAILABLE_STUDENT_CARD_FIELDS,
    keyForField: (field) => `students.cardTemplate.field.${field}`,
  },
];

describe("template editor label translations", () => {
  it.each(surfaces)("$name field labels have translation keys", (surface) => {
    for (const field of surface.fields) {
      const key = surface.keyForField(String(field.field));
      expect(enKeys.has(key), `missing translation for ${key}`).toBe(true);
    }
  });

  it.each(surfaces.filter((surface) => surface.presets))(
    "$name preset labels have translation keys",
    (surface) => {
      for (const preset of surface.presets ?? []) {
        const key = surface.keyForPreset!(preset.key);
        expect(enKeys.has(key), `missing translation for ${key}`).toBe(true);
      }
    },
  );

  it("keeps preset keys unique per module", () => {
    for (const surface of surfaces) {
      const keys = (surface.presets ?? []).map((preset) => preset.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
