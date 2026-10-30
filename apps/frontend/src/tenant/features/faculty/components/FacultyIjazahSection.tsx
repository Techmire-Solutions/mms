import React, { useState } from "react";
import { Award, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultyIjazah } from "@mms/shared";

export interface FacultyIjazahSectionProps {
  ijazahs?: FacultyIjazah[];
  onChange: (ijazahs: FacultyIjazah[]) => void;
}

export function FacultyIjazahSection({
  ijazahs = [],
  onChange,
}: FacultyIjazahSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [field, setField] = useState<FacultyIjazah["field"]>("quran");
  const [grantingAuthority, setGrantingAuthority] = useState("");
  const [year, setYear] = useState<string>("");
  const [sanadChain, setSanadChain] = useState("");

  const resetForm = () => {
    setTitle("");
    setField("quran");
    setGrantingAuthority("");
    setYear("");
    setSanadChain("");
    setIsAdding(false);
  };

  const handleAdd = () => {
    if (!title.trim() || !grantingAuthority.trim()) return;
    const newEntry: FacultyIjazah = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ijz_${Date.now()}`,
      title: title.trim(),
      field,
      grantingAuthority: grantingAuthority.trim(),
      year: year ? Number(year) || year : undefined,
      sanadChain: sanadChain.trim() || undefined,
    };
    onChange([...ijazahs, newEntry]);
    resetForm();
  };

  const handleRemove = (id: string) => {
    onChange(ijazahs.filter((item) => item.id !== id));
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
    <div className="space-y-4 text-start">
      <SectionCard
        title={t("faculty.ijazah.title")}
        icon={Award}
        accentColor="primary"
        actions={
          !isAdding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="gap-1.5 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              <span>{t("faculty.ijazah.add")}</span>
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {ijazahs.length === 0 && !isAdding && (
            <p className="text-xs text-muted-foreground italic py-2">
              {t("faculty.ijazah.noIjazahs")}
            </p>
          )}

          {ijazahs.map((ijazah) => {
            const disciplineLabel =
              disciplineOptions.find((opt) => opt.value === ijazah.field)?.label ?? ijazah.field;
            return (
              <div
                key={ijazah.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border/70 bg-muted/30"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{ijazah.title}</span>
                    <span className="px-2 py-0.5 rounded text-3xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {disciplineLabel}
                    </span>
                    {ijazah.year && (
                      <span className="text-xs text-muted-foreground">({ijazah.year})</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{ijazah.grantingAuthority}</span>
                  </p>
                  {ijazah.sanadChain && (
                    <p className="text-xs text-muted-foreground line-clamp-2 pt-1 border-t border-border/40 mt-1 italic">
                      {ijazah.sanadChain}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(ijazah.id)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}

          {isAdding && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label={t("faculty.ijazah.name")} id="ijazah-title" required>
                  <Input
                    id="ijazah-title"
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                    placeholder={t("faculty.ijazah.namePlaceholder")}
                  />
                </Field>

                <Field label={t("faculty.ijazah.discipline")} id="ijazah-discipline" required>
                  <FormSelect
                    id="ijazah-discipline"
                    value={field}
                    onChange={(val) => setField(val as FacultyIjazah["field"])}
                    options={disciplineOptions}
                  />
                </Field>

                <Field label={t("faculty.ijazah.grantingAuthority")} id="ijazah-authority" required>
                  <Input
                    id="ijazah-authority"
                    value={grantingAuthority}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setGrantingAuthority(e.target.value)
                    }
                    placeholder="e.g. Sheikh Abu al-Hasan..."
                  />
                </Field>

                <Field label={t("faculty.ijazah.year")} id="ijazah-year">
                  <Input
                    id="ijazah-year"
                    value={year}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYear(e.target.value)}
                    placeholder="e.g. 1442 / 2021"
                  />
                </Field>
              </div>

              <Field label={t("faculty.ijazah.sanadChain")} id="ijazah-sanad">
                <Textarea
                  id="ijazah-sanad"
                  rows={2}
                  value={sanadChain}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setSanadChain(e.target.value)
                  }
                  placeholder={t("faculty.ijazah.sanadChainPlaceholder")}
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!title.trim() || !grantingAuthority.trim()}
                >
                  {t("faculty.ijazah.add")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
