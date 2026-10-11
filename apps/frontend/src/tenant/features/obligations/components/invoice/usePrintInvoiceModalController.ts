import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { getPageDimensions, useInvoiceTemplate } from "@/lib/invoiceTemplateStore";
import {
  type ObligationCollection,
  type ObligationType,
  type MujtahidRep,
  type Mujtahid,
} from "@/lib/data/obligationsData";
import { DEFAULT_CURRENCIES } from "@mms/shared";
import {
  useMergedObligationContacts,
  useMergedObligationUsers,
} from "@/tenant/features/obligations/hooks/useObligationLookups";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { buildPrintWindowHtml } from "@/lib/printWindowHtml";

interface UsePrintInvoiceModalControllerProps {
  collection: ObligationCollection;
  obligationTypes?: ObligationType[];
  reps?: MujtahidRep[];
  mujtahids?: Mujtahid[];
}

export function usePrintInvoiceModalController({
  collection,
  obligationTypes = [],
  reps = [],
  mujtahids = [],
}: UsePrintInvoiceModalControllerProps) {
  const { t, language, isRtl } = useTranslation();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { template } = useInvoiceTemplate();
  const size = getPageDimensions(template.pageSize, template.orientation);
  const printRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  const contactIds = useMemo(
    () => [collection.sender_id, collection.reference_id],
    [collection.sender_id, collection.reference_id],
  );
  const userIds = useMemo(() => [collection.received_by], [collection.received_by]);
  const liveContacts = useMergedObligationContacts(contactIds);
  const liveUsers = useMergedObligationUsers(userIds);

  const lookups = useMemo(
    () => ({
      contacts: liveContacts,
      users: liveUsers,
      currencies: DEFAULT_CURRENCIES,
      obligationTypes,
      mujtahids,
      reps,
    }),
    [liveContacts, liveUsers, obligationTypes, mujtahids, reps],
  );

  const handlePrint = useCallback(() => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=800,height=700");
    if (!printWindow) {
      notify.error(t("templateEditor.exportFailed"));
      return;
    }

    printWindow.document.write(
      buildPrintWindowHtml({
        windowTitle: t("obligations.print.windowTitle", { number: collection.receipt_no }),
        language: language || "en",
        direction: isRtl ? "rtl" : "ltr",
        width: size.width,
        height: size.height,
        orientation: template.orientation || "portrait",
        bodyContent: content.innerHTML,
      }),
    );
    printWindow.document.close();
  }, [collection.receipt_no, isRtl, language, size.height, size.width, t, template.orientation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrint]);

  const handleExportPDF = useCallback(async () => {
    const target = exportRef.current || printRef.current;
    if (!target || isGeneratingPdf) return;

    try {
      setIsGeneratingPdf(true);
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(target.querySelectorAll("img"));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            }),
        ),
      );

      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const html2canvas = html2canvasModule.default;
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;

      const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
      const adaptiveScale = Math.max(2, Math.min(3, pixelRatio));

      const canvas = await html2canvas(target, {
        scale: adaptiveScale,
        useCORS: true,
        logging: false,
        backgroundColor: "white",
        width: size.width,
        height: size.height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        windowWidth: size.width,
        windowHeight: size.height,
      });

      const imgData = canvas.toDataURL("image/png");
      const orientation = size.width > size.height ? "landscape" : "portrait";
      const pdfWidth = size.width * 0.264583;
      const pdfHeight = size.height * 0.264583;

      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [pdfWidth, pdfHeight],
      });

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
      pdf.save(`Receipt-${collection.receipt_no || "obligation"}.pdf`);
    } catch {
      notify.error(t("templateEditor.exportFailed"));
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [collection.receipt_no, handlePrint, isGeneratingPdf, size.height, size.width, t]);

  return {
    template,
    size,
    isRtl,
    printRef,
    exportRef,
    lookups,
    isGeneratingPdf,
    handlePrint,
    handleExportPDF,
  };
}
