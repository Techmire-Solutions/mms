import React from "react";

export interface StudentIdCardPrintStylesProps {
  width: number;
  height: number;
  orientation?: string;
}

/**
 * Injects dedicated print CSS rules ensuring only the ID cards print at exact paper dimensions,
 * hiding all modal chrome, footers, headers, and background app containers.
 */
export function StudentIdCardPrintStyles({
  width,
  height,
  orientation = "landscape",
}: StudentIdCardPrintStylesProps): React.JSX.Element {
  return (
    <style>{`
      @media print {
        @page {
          size: ${width}px ${height}px ${orientation};
          margin: 0;
        }
        html, body {
          width: ${width}px !important;
          height: ${height}px !important;
          margin: 0 !important;
          padding: 0 !important;
          background: white !important;
          overflow: visible !important;
        }
        body > :not([data-slot="overlay-root"]),
        [data-overlay-backdrop],
        [data-print-hide],
        [data-slot="modal-header"],
        [data-slot="modal-footer"],
        [data-slot="modal-controls"] {
          display: none !important;
        }
        [data-slot="overlay-root"] {
          position: static !important;
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          background: transparent !important;
        }
        [role="dialog"] {
          position: static !important;
          display: block !important;
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          max-height: none !important;
          max-width: none !important;
          width: ${width}px !important;
          height: auto !important;
        }
        .id-card-print-container {
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          overflow: visible !important;
          max-height: none !important;
          width: ${width}px !important;
        }
        .id-card-print-page {
          width: ${width}px !important;
          height: ${height}px !important;
          min-width: ${width}px !important;
          min-height: ${height}px !important;
          max-width: ${width}px !important;
          max-height: ${height}px !important;
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          margin: 0 auto !important;
          padding: 0 !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow: hidden !important;
        }
        .id-card-print-page:last-child {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      }
    `}</style>
  );
}

export default StudentIdCardPrintStyles;
