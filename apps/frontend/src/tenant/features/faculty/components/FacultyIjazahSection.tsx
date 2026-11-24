import React, { useState } from "react";
import { Award } from "lucide-react";
import type { FacultyIjazah } from "@mms/contracts";
import { Field, FormCollectionShell, FormListFieldCard } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyIjazahSectionProps {
  ijazahs?: FacultyIjazah[];
  onChange: (ijazahs: FacultyIjazah[]) => void;
}

function newIjazah(): FacultyIjazah {
  return {
    id: crypto.randomUUID(),
    title: "",
    field: "quran",
    grantingAuthority: "",
    year: undefined,
    sanadChain: undefined,
  };
}

export function FacultyIjazahSection({
  ijazahs = [],
  onChange,
}: FacultyIjazahSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const update = (id: string, patch: Partial<FacultyIjazah>): void => {
    onChange(ijazahs.map((ijazah) => (ijazah.id === id ? { ...ijazah, ...patch } : ijazah)));
  };

  const disciplineOptions = [
    { value: "quran", label: t("faculty.ijazah.discipline.quran") },
    { value: "hadith", label: t("faculty.ijazah.discipline.hadith") },
    { value: "fiqh", label: t("faculty.ijazah.discipline.fiqh") },
    { value: "arabic", label: t("faculty.ijazah.discipline.arabic") },
    { value: "aqeedah", label: t("faculty.ijazah.discipline.aqeedah") },
    { value: "other", label: t("faculty.ijazah.discipline.other") },
  ];

  return (
    <FormCollectionShell
      title={t("faculty.ijazah.title")}
      icon={Award}
      addLabel={t("faculty.ijazah.add")}
      onAdd={() => onChange([...ijazahs, newIjazah()])}
      listKey="faculty-ijazahs"
    >
      {ijazahs.length === 0 ? (
        <p className="py-2 text-xs italic text-muted-foreground">{t("faculty.ijazah.noIjazahs")}</p>
      ) : null}

      {ijazahs.map((ijazah, index) => {
        const titleError =
          touched[`${ijazah.id}:title`] && !ijazah.title.trim()
            ? t("common.fieldRequired", { field: t("faculty.ijazah.name") })
            : undefined;
        const authorityError =
          touched[`${ijazah.id}:authority`] && !ijazah.grantingAuthority.trim()
            ? t("common.fieldRequired", { field: t("faculty.ijazah.grantingAuthority") })
            : undefined;

        return (
          <FormListFieldCard
            key={ijazah.id}
            id={ijazah.id}
            index={index}
            label={`${index + 1}`}
            removeLabel={t("common.delete")}
            canRemove
            onRemove={() => onChange(ijazahs.filter((row) => row.id !== ijazah.id))}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field
                label={t("faculty.ijazah.name")}
                id={`ijazah-title-${ijazah.id}`}
                required
                error={titleError}
              >
                <Input
                  id={`ijazah-title-${ijazah.id}`}
                  name={`ijazah-title-${ijazah.id}`}
                  value={ijazah.title}
                  aria-invalid={Boolean(titleError) || undefined}
                  placeholder={t("faculty.ijazah.namePlaceholder")}
                  onChange={(event) => update(ijazah.id, { title: event.target.value })}
                  onBlur={() => setTouched((prev) => ({ ...prev, [`${ijazah.id}:title`]: true }))}
                />
              </Field>

              <Field label={t("faculty.ijazah.discipline")} id={`ijazah-field-${ijazah.id}`}>
                <FormSelect
                  id={`ijazah-field-${ijazah.id}`}
                  name={`ijazah-field-${ijazah.id}`}
                  value={ijazah.field}
                  onChange={(value) =>
                    update(ijazah.id, { field: value as FacultyIjazah["field"] })
                  }
                  options={disciplineOptions}
                />
              </Field>

              <Field
                label={t("faculty.ijazah.grantingAuthority")}
                id={`ijazah-authority-${ijazah.id}`}
                required
                error={authorityError}
              >
                <Input
                  id={`ijazah-authority-${ijazah.id}`}
                  name={`ijazah-authority-${ijazah.id}`}
                  value={ijazah.grantingAuthority}
                  aria-invalid={Boolean(authorityError) || undefined}
                  placeholder={t("faculty.ijazah.authorityPlaceholder")}
                  onChange={(event) => update(ijazah.id, { grantingAuthority: event.target.value })}
                  onBlur={() =>
                    setTouched((prev) => ({ ...prev, [`${ijazah.id}:authority`]: true }))
                  }
                />
              </Field>

              <Field label={t("faculty.ijazah.year")} id={`ijazah-year-${ijazah.id}`}>
                <Input
                  id={`ijazah-year-${ijazah.id}`}
                  name={`ijazah-year-${ijazah.id}`}
                  value={
                    ijazah.year === undefined || ijazah.year === null ? "" : String(ijazah.year)
                  }
                  placeholder={t("faculty.ijazah.yearPlaceholder")}
                  onChange={(event) =>
                    update(ijazah.id, {
                      year: event.target.value ? event.target.value : undefined,
                    })
                  }
                />
              </Field>
            </div>

            <Field label={t("faculty.ijazah.sanadChain")} id={`ijazah-sanad-${ijazah.id}`}>
              <Textarea
                id={`ijazah-sanad-${ijazah.id}`}
                name={`ijazah-sanad-${ijazah.id}`}
                rows={2}
                value={ijazah.sanadChain ?? ""}
                placeholder={t("faculty.ijazah.sanadChainPlaceholder")}
                onChange={(event) =>
                  update(ijazah.id, {
                    sanadChain: event.target.value ? event.target.value : undefined,
                  })
                }
              />
            </Field>
          </FormListFieldCard>
        );
      })}
    </FormCollectionShell>
  );
}
