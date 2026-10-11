import { motion } from "framer-motion";
import { Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

const MotionCard = motion.create(Card);

export interface MarkAttendanceFacePlaceholderProps {
  onClose: () => void;
}

export function MarkAttendanceFacePlaceholder({
  onClose,
}: MarkAttendanceFacePlaceholderProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <MotionCard
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      accentColor="primary"
      className="p-6 text-center space-y-4 shadow-sm"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <Scan className="w-8 h-8 text-primary" aria-hidden="true" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground m-0">
          {t("attendance.mark.facialRecognition")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {t("attendance.mark.facialRecognitionDesc")}
        </p>
        <Badge pill tone="warning" className="mt-2 px-2.5 py-1 font-bold bg-warning/15">
          {t("attendance.mark.comingSoon")}
        </Badge>
      </div>
      <div className="h-40 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-16 h-20 border-2 border-primary/30 rounded-lg mx-auto flex items-center justify-center">
            <div className="w-8 h-10 border border-primary/20 rounded-sm" />
          </div>
          <p className="text-xs text-muted-foreground">{t("attendance.mark.cameraPreview")}</p>
        </div>
      </div>
      <Button
        onClick={onClose}
        variant="ghost"
        size="sm"
        className="min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {t("attendance.mark.dismiss")}
      </Button>
    </MotionCard>
  );
}
