/**
 * @file hasanatTemplateData.ts
 * @description Hasanat voucher payload, fields, default layout and presets.
 *
 * Split out of the editor component so the print path can build a payload and read
 * the factory layout without importing (and eagerly bundling) the editor.
 */

import type {
  DocumentTemplate,
  DocumentTemplatePreset,
  TemplateFieldDefinition,
} from "@mms/shared";
import {
  PRINT_EMERALD,
  PRINT_EMERALD_LIGHT,
  PRINT_EMERALD_DEEP,
  PRINT_SLATE_MUTED,
} from "@/lib/ui/printTemplateStyles";

export interface HasanatPayload {
  receiptNo: string;
  donorName: string;
  recipientName: string;
  denomination: string;
  totalPoints: number | string;
  issueDate: string;
  expiryDate: string;
  purpose: string;
  issuedBy: string;
  institution: string;
}

export const HASANAT_TEMPLATE_STORAGE_KEY = "mms_hasanat_voucher_template";

export const HASANAT_AVAILABLE_FIELDS: TemplateFieldDefinition<HasanatPayload>[] = [
  { field: "receiptNo", label: "Voucher / Slip No", sampleValue: "HAS-2026-904" },
  { field: "donorName", label: "Donor / Sponsor", sampleValue: "Hajj Ahmad" },
  { field: "recipientName", label: "Recipient Name", sampleValue: "Zaid bin Harith" },
  { field: "denomination", label: "Denomination Unit", sampleValue: "Silver Deed (10 Pts)" },
  { field: "totalPoints", label: "Total Points / Value", sampleValue: "50 Hasanat" },
  { field: "issueDate", label: "Issue Date", sampleValue: "2026-09-12" },
  { field: "expiryDate", label: "Valid Through", sampleValue: "2027-09-12" },
  { field: "purpose", label: "Charity Purpose", sampleValue: "Quranic Excellence Reward" },
  { field: "issuedBy", label: "Authorized Officer", sampleValue: "Admin Office" },
  { field: "institution", label: "Institution Name", sampleValue: "Madrasa Management System" },
];

// Print tokens imported from lib/printTemplateStyles.ts SSOT.
// Aliases preserve local readability without re-declaring hex literals.
const PRINT_HASANAT_EMERALD = PRINT_EMERALD;
const PRINT_HASANAT_EMERALD_LIGHT = PRINT_EMERALD_LIGHT;
const PRINT_HASANAT_EMERALD_DEEP = PRINT_EMERALD_DEEP;
const PRINT_HASANAT_MUTED_SLATE = PRINT_SLATE_MUTED;

export const DEFAULT_HASANAT_TEMPLATE: DocumentTemplate<HasanatPayload> = {
  pageSize: "A6",
  orientation: "landscape",
  elements: [
    {
      id: "h_inst",
      type: "field",
      field: "institution",
      label: "Madrasa Management System",
      x: 20,
      y: 16,
      w: 340,
      h: 22,
      style: { fontSize: 13, fontWeight: "bold", textAlign: "center" },
    },
    {
      id: "h_title",
      type: "static",
      label: "سند صرف حسنات | Hasanat Award Voucher",
      x: 20,
      y: 40,
      w: 340,
      h: 18,
      style: { fontSize: 10, textAlign: "center", color: PRINT_HASANAT_EMERALD },
    },
    {
      id: "h_div1",
      type: "divider",
      label: "",
      x: 20,
      y: 62,
      w: 519,
      h: 1,
      style: { color: PRINT_HASANAT_EMERALD_LIGHT },
    },
    {
      id: "h_no",
      type: "field",
      field: "receiptNo",
      label: "HAS-2026-904",
      x: 380,
      y: 16,
      w: 159,
      h: 18,
      style: { fontSize: 10, fontWeight: "bold", textAlign: "right" },
    },
    {
      id: "h_recip",
      type: "field",
      field: "recipientName",
      label: "المستفيد: Zaid bin Harith",
      x: 20,
      y: 76,
      w: 260,
      h: 18,
      style: { fontSize: 10, fontWeight: "bold" },
    },
    {
      id: "h_denom",
      type: "field",
      field: "denomination",
      label: "الفئة: Silver Deed (10 Pts)",
      x: 20,
      y: 98,
      w: 260,
      h: 18,
      style: { fontSize: 10 },
    },
    {
      id: "h_pts",
      type: "field",
      field: "totalPoints",
      label: "50 Hasanat",
      x: 320,
      y: 84,
      w: 219,
      h: 32,
      style: {
        fontSize: 16,
        fontWeight: "bold",
        color: PRINT_HASANAT_EMERALD_DEEP,
        textAlign: "center",
      },
    },
    { id: "h_qr", type: "qrcode", label: "QR Verify", x: 20, y: 130, w: 54, h: 54 },
    {
      id: "h_by",
      type: "field",
      field: "issuedBy",
      label: "المسؤول: Admin Office",
      x: 320,
      y: 160,
      w: 219,
      h: 16,
      style: { fontSize: 9, textAlign: "right", color: PRINT_HASANAT_MUTED_SLATE },
    },
  ],
};

export const HASANAT_PRESETS: DocumentTemplatePreset<HasanatPayload>[] = [
  {
    key: "hasanat_a6_voucher",
    label: "Hasanat Merit Award Slip (A6)",
    description: "Compact reward and distribution certificate",
    template: DEFAULT_HASANAT_TEMPLATE,
  },
  {
    key: "hasanat_pos_80mm",
    label: "Thermal POS Slip (80mm)",
    description: "Instant counter printed redemption ticket",
    template: {
      pageSize: "80mm",
      orientation: "portrait",
      elements: [
        {
          id: "pos_inst",
          type: "field",
          field: "institution",
          label: "Madrasa System",
          x: 10,
          y: 12,
          w: 282,
          h: 20,
          style: { fontSize: 12, fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "pos_no",
          type: "field",
          field: "receiptNo",
          label: "HAS-2026-904",
          x: 10,
          y: 34,
          w: 282,
          h: 16,
          style: { fontSize: 10, textAlign: "center" },
        },
        { id: "pos_div", type: "divider", label: "", x: 10, y: 52, w: 282, h: 1 },
        {
          id: "pos_pts",
          type: "field",
          field: "totalPoints",
          label: "50 Hasanat",
          x: 10,
          y: 64,
          w: 282,
          h: 28,
          style: { fontSize: 16, fontWeight: "bold", textAlign: "center" },
        },
      ],
    },
  },
];
