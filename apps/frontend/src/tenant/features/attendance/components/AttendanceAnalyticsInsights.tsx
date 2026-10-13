import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { ProgressBar } from "@/components/app/ProgressBar";
import { WarningCallout } from "@/components/app/WarningCallout";
import { motion } from "framer-motion";
import type { StudentRateEntry } from "@/tenant/features/attendance/hooks/useAttendanceAnalyticsModel";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface AttendanceAnalyticsInsightsProps {
  t: TranslationFunction;
  lowAttendance: StudentRateEntry[];
  lowAttendanceCount: number;
  topStudents: StudentRateEntry[];
}

export function AttendanceAnalyticsInsights({
  t,
  lowAttendance,
  lowAttendanceCount,
  topStudents,
}: AttendanceAnalyticsInsightsProps): React.JSX.Element {
  return (
    <>
      {lowAttendance.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <WarningCallout
            title={t("attendance.analytics.lowAlertTitle", { count: lowAttendanceCount })}
            className="items-start p-4"
            role="alert"
          >
            <div className="mt-3 flex flex-wrap gap-2">
              {lowAttendance.map((studentRate) => (
                <div
                  key={studentRate.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/45 backdrop-blur-sm border border-warning/30"
                >
                  <span className="text-xs font-semibold text-foreground">{studentRate.name}</span>
                  <span className="text-xs font-bold text-destructive">{studentRate.rate}%</span>
                </div>
              ))}
            </div>
          </WarningCallout>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.45, ease: "easeOut" }}
      >
        <Card accentColor="success" className={cn("p-4", CARD_STRIPE_INSET)}>
          <h2 className="text-sm font-bold text-foreground mb-3 m-0">
            {t("attendance.analytics.charts.topPerformersTitle")}
          </h2>
          <div className="space-y-2">
            {topStudents.map((studentRate, index) => (
              <div key={studentRate.id} className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-warning/15 text-warning" : index === 1 ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning"}`}
                >
                  {index + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {studentRate.name}
                    </span>
                    <span className="text-xs font-bold text-success">{studentRate.rate}%</span>
                  </div>
                  <ProgressBar
                    value={studentRate.rate}
                    fillClassName="bg-success"
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </>
  );
}
