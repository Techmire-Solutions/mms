import React from "react";
import { Award, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/FormSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/FormField";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { SessionClassScholarship } from "@/lib/data/sessionsData";

interface ClassDetailScholarshipTabProps {
  scholarship: SessionClassScholarship;
  onUpdateScholarship: (patch: Partial<SessionClassScholarship>) => void;
  onUpdateEligibility: (
    patch: Partial<NonNullable<SessionClassScholarship["eligibility"]>>,
  ) => void;
}

export function ClassDetailScholarshipTab({
  scholarship,
  onUpdateScholarship,
  onUpdateEligibility,
}: ClassDetailScholarshipTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const eligibility = scholarship.eligibility;

  return (
    <div className="space-y-3">
      <SectionCard
        title={t("sessions.classes.detail.scholarship.rateTitle")}
        icon={Award}
        accentColor="secondary"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="sch-pct" label={t("sessions.classes.detail.scholarship.percentage")}>
            <div className="relative">
              <Input
                id="sch-pct"
                name="percentage"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={scholarship.percentage === 0 ? "" : String(scholarship.percentage)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d*(\.\d{0,2})?$/.test(val)) {
                    const num = parseFloat(val) || 0;
                    if (num <= 100) onUpdateScholarship({ percentage: num });
                  }
                }}
                className="pe-6"
              />
              <span className="absolute end-3 top-2.5 text-xs text-muted-foreground">%</span>
            </div>
          </Field>

          <Field id="sch-expiry" label={t("sessions.classes.detail.scholarship.expiry")}>
            <Input
              id="sch-expiry"
              name="expiryDate"
              type="date"
              value={scholarship.expiryDate || ""}
              onChange={(e) => onUpdateScholarship({ expiryDate: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title={t("sessions.classes.detail.scholarship.criteriaTitle")}
        icon={Users}
        accentColor="primary"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex min-h-11 items-center gap-3 rounded-lg border border-border/60 p-3 hover:bg-muted/30">
              <Checkbox
                id="scholarship-orphan"
                checked={Boolean(eligibility?.orphan)}
                onCheckedChange={(checked) => onUpdateEligibility({ orphan: checked === true })}
                className="h-4 w-4"
              />
              <label htmlFor="scholarship-orphan" className="cursor-pointer">
                <p className="text-xs font-medium text-foreground">
                  {t("sessions.classes.detail.scholarship.orphan")}
                </p>
                <p className="text-3xs text-muted-foreground">
                  {t("sessions.classes.detail.scholarship.orphanHint")}
                </p>
              </label>
            </div>

            <Field id="residence-type" label={t("sessions.classes.detail.scholarship.residence")}>
              <FormSelect
                id="residence-type"
                name="residence"
                value={eligibility?.residence || "rental"}
                onChange={(val) => onUpdateEligibility({ residence: val })}
                options={[
                  {
                    value: "rental",
                    label: t("sessions.classes.detail.scholarship.residence.rental"),
                  },
                  {
                    value: "owned",
                    label: t("sessions.classes.detail.scholarship.residence.owned"),
                  },
                  {
                    value: "relative",
                    label: t("sessions.classes.detail.scholarship.residence.relative"),
                  },
                  {
                    value: "other",
                    label: t("sessions.classes.detail.scholarship.residence.other"),
                  },
                ]}
                className="w-full text-xs"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field
              id="family-members"
              label={t("sessions.classes.detail.scholarship.familyMembers")}
            >
              <Input
                id="family-members"
                name="familyMembers"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={
                  eligibility?.familyMembers === 0 ? "" : String(eligibility?.familyMembers ?? "")
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    onUpdateEligibility({ familyMembers: parseInt(val, 10) || 0 });
                  }
                }}
                className="text-xs"
              />
            </Field>

            <Field
              id="earning-members"
              label={t("sessions.classes.detail.scholarship.earningMembers")}
            >
              <Input
                id="earning-members"
                name="earningMembers"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={
                  eligibility?.onJobMembers === 0 ? "" : String(eligibility?.onJobMembers ?? "")
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    onUpdateEligibility({ onJobMembers: parseInt(val, 10) || 0 });
                  }
                }}
                className="text-xs"
              />
            </Field>

            <Field id="studying-siblings" label={t("sessions.classes.detail.scholarship.siblings")}>
              <Input
                id="studying-siblings"
                name="studyingSiblings"
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={
                  eligibility?.schoolGoingSiblings === 0
                    ? ""
                    : String(eligibility?.schoolGoingSiblings ?? "")
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^\d+$/.test(val)) {
                    onUpdateEligibility({ schoolGoingSiblings: parseInt(val, 10) || 0 });
                  }
                }}
                className="text-xs"
              />
            </Field>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
