import React, { useRef } from "react";
import { Printer, FileCode2 } from "lucide-react";
import { getRankSuffix } from "@/tenant/features/examinations/components/gradeUtils";
import { type StudentResultItem } from "@/tenant/features/examinations/components/StudentResultCard";
import { type Exam } from "@/lib/data/examinationData";
import { formatDate } from "@mms/shared";
import { useBrandPalette } from "@/lib/contexts/BrandingPaletteContext";
import { PRINT_NEUTRAL } from "@/lib/printBrandingTokens";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import {
  printHtmlDocument,
  exportTypstReportCard,
} from "@/tenant/features/examinations/components/certificatePrintWindow";

export interface CertificatePreviewProps {
  result: StudentResultItem;
  exam: Exam;
  onClose: () => void;
}

/**
 * Preview modal displaying student certificates with print features.
 */
export function CertificatePreview({
  result,
  exam,
  onClose,
}: CertificatePreviewProps): React.JSX.Element {
  const certRef = useRef<HTMLDivElement | null>(null);
  const { primary, secondary } = useBrandPalette();
  const { t } = useTranslation();

  const rankLabel = getRankSuffix(result.rank);
  const date = formatDate(exam.date, true);

  const handlePrint = () => {
    if (!certRef.current) return;
    const title = t("examinations.certificatePreview.windowTitle", {
      name: result.student?.name || t("examinations.certificatePreview.studentFallback"),
    });
    printHtmlDocument(title, certRef.current.innerHTML);
  };

  const handleExportTypst = () => {
    exportTypstReportCard(result, exam, rankLabel);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("examinations.certificatePreview.title")}
      size="lg"
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportTypst}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer"
            title={t("examinations.certificatePreview.exportTypstTooltip")}
          >
            <FileCode2 className="w-3.5 h-3.5 text-info" aria-hidden="true" />
            <span>{t("templateEditor.typst")}</span>
          </Button>
          <Button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />{" "}
            {t("examinations.certificatePreview.printDownload")}
          </Button>
        </div>
      }
    >
      <div ref={certRef}>
        <div
          style={{
            width: "100%",
            background: PRINT_NEUTRAL.paper,
            border: `16px solid ${primary}`,
            outline: `4px solid ${secondary}`,
            outlineOffset: "-20px",
            padding: "40px 48px",
            textAlign: "center",
            fontFamily: "'Inter', sans-serif",
            position: "relative",
            minHeight: "420px",
          }}
        >
          {/* Corner ornaments */}
          {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map(
            (cornerPosition) => {
              const cornerStyles: React.CSSProperties = {
                position: "absolute",
                [cornerPosition.includes("top") ? "insetBlockStart" : "insetBlockEnd"]: "8px",
                [cornerPosition.includes("left") ? "insetInlineStart" : "insetInlineEnd"]: "8px",
                width: "32px",
                height: "32px",
                borderBlockStart: cornerPosition.includes("top")
                  ? `4px solid ${secondary}`
                  : "none",
                borderBlockEnd: cornerPosition.includes("bottom")
                  ? `4px solid ${secondary}`
                  : "none",
                borderInlineStart: cornerPosition.includes("left")
                  ? `4px solid ${secondary}`
                  : "none",
                borderInlineEnd: cornerPosition.includes("right")
                  ? `4px solid ${secondary}`
                  : "none",
              };
              return <div key={cornerPosition} style={cornerStyles} />;
            },
          )}

          {/* Arabic bismillah */}
          <p
            style={{
              fontFamily: "'Amiri', serif",
              fontSize: "20px",
              color: primary,
              marginBottom: "4px",
            }}
          >
            بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
          </p>

          <div
            style={{
              width: "60px",
              height: "2px",
              background: `linear-gradient(to right, ${secondary}, ${primary}, ${secondary})`,
              margin: "12px auto",
            }}
          />

          {/* Institution */}
          <p
            style={{
              fontSize: "11px",
              fontWeight: "700",
              letterSpacing: "4px",
              color: PRINT_NEUTRAL.caption,
              textTransform: "uppercase",
              marginBottom: "16px",
            }}
          >
            {t("examinations.certificatePreview.institutionName")}
          </p>

          {/* Title */}
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "700",
              color: primary,
              fontFamily: "'Amiri', serif",
              marginBottom: "4px",
            }}
          >
            {t("examinations.certificatePreview.certificateTitle")}
          </h1>
          <p style={{ fontSize: "12px", color: PRINT_NEUTRAL.subcaption, marginBottom: "24px" }}>
            {t("examinations.certificatePreview.certifyText")}
          </p>

          {/* Student name */}
          <h2
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: PRINT_NEUTRAL.text,
              borderBottom: `2px solid ${secondary}`,
              display: "inline-block",
              padding: "0 24px 6px",
              marginBottom: "20px",
            }}
          >
            {result.student?.name}
          </h2>

          {/* Body text */}
          <p
            style={{
              fontSize: "13px",
              color: PRINT_NEUTRAL.body,
              lineHeight: "1.8",
              maxWidth: "480px",
              margin: "0 auto 20px",
            }}
          >
            {t("examinations.certificatePreview.bodyPrefix")}{" "}
            <strong style={{ color: primary }}>{exam.subject}</strong> — <em>{exam.name}</em>,{" "}
            {t("examinations.certificatePreview.bodyScore")}{" "}
            <strong style={{ color: primary }}>
              {result.marksObtained} {t("examinations.certificatePreview.outOf")} {exam.totalMarks}
            </strong>{" "}
            ({result.pct}%) {t("examinations.certificatePreview.bodyRank")}{" "}
            <strong style={{ color: secondary }}>
              {rankLabel} {t("examinations.certificatePreview.position")}
            </strong>{" "}
            {t("examinations.certificatePreview.bodySuffix")}
          </p>

          {/* Grade badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              background: result.grade.bg,
              border: `2px solid ${result.grade.border}`,
              borderRadius: "12px",
              padding: "8px 24px",
              marginBottom: "24px",
            }}
          >
            <span style={{ fontSize: "24px", fontWeight: "700", color: result.grade.color }}>
              {result.grade.label}
            </span>
            <span style={{ fontSize: "12px", color: PRINT_NEUTRAL.caption }}>
              {t("examinations.certificatePreview.gradeLabel")}
            </span>
            <div style={{ width: "1px", height: "24px", background: result.grade.border }} />
            <span style={{ fontSize: "16px", fontWeight: "700", color: result.grade.color }}>
              {result.pct}%
            </span>
          </div>

          {/* Date & signatures row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: "24px",
              borderTop: `1px solid ${PRINT_NEUTRAL.border}`,
              paddingTop: "16px",
            }}
          >
            <div style={{ textAlign: "start" }}>
              <div
                style={{
                  width: "120px",
                  borderBottom: `1px solid ${PRINT_NEUTRAL.subcaption}`,
                  marginBottom: "4px",
                }}
              />
              <p style={{ fontSize: "10px", color: PRINT_NEUTRAL.caption }}>
                {t("examinations.certificatePreview.classTeacher")}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "10px", color: PRINT_NEUTRAL.subcaption }}>
                {t("examinations.certificatePreview.examDate")}
              </p>
              <p style={{ fontSize: "12px", fontWeight: "600", color: PRINT_NEUTRAL.emphasis }}>
                {date}
              </p>
            </div>
            <div style={{ textAlign: "end" }}>
              <div
                style={{
                  width: "120px",
                  borderBottom: `1px solid ${PRINT_NEUTRAL.subcaption}`,
                  marginBottom: "4px",
                  marginInlineStart: "auto",
                }}
              />
              <p style={{ fontSize: "10px", color: PRINT_NEUTRAL.caption }}>
                {t("examinations.certificatePreview.principalDirector")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
