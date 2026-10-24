import type { TemplateElement } from "@/lib/invoiceTemplateTypes";
import type { InvoicePresetPalette } from "./palette";

/**
 * Amount + footer block of the Formal A5 preset (amount, amount-in-words, QR,
 * signature line and blessing). Split from the header block so each module stays
 * under the 300-line ceiling.
 */
export function buildFormalA5AmountElements(p: InvoicePresetPalette): TemplateElement[] {
  const { primary, text, border, label, muted, tr } = p;

  return [
    {
      id: "fm_amt_lbl",
      type: "static",
      label: tr("amountReceived"),
      x: 30,
      y: 272,
      w: 120,
      h: 22,
      style: { fontSize: 12, fontWeight: "bold", color: label },
    },
    {
      id: "fm_amt_val",
      type: "field",
      label: "Amount",
      field: "amount",
      x: 155,
      y: 270,
      w: 200,
      h: 24,
      style: { fontSize: 16, fontWeight: "bold", color: primary, fontFamily: "monospace" },
    },
    {
      id: "fm_words_lbl",
      type: "static",
      label: tr("inWords"),
      x: 30,
      y: 302,
      w: 70,
      h: 16,
      style: { fontSize: 10, fontWeight: "bold", color: label },
    },
    {
      id: "fm_words_val",
      type: "field",
      label: "Amount in Words",
      field: "amount_in_words",
      x: 105,
      y: 302,
      w: 420,
      h: 20,
      style: { fontSize: 10, fontStyle: "italic", color: text },
    },
    {
      id: "fm_div4",
      type: "divider",
      label: "",
      x: 30,
      y: 334,
      w: 499,
      h: 1,
      style: { color: border },
    },
    { id: "fm_qr", type: "qrcode", label: "Verification QR", x: 40, y: 360, w: 75, h: 75 },
    {
      id: "fm_sign_box",
      type: "static",
      label: "Authorized Signatory / ختم وتوقيع المسؤول",
      x: 310,
      y: 410,
      w: 210,
      h: 18,
      style: { fontSize: 9, textAlign: "center", color: muted },
    },
    {
      id: "fm_sign_line",
      type: "divider",
      label: "",
      x: 310,
      y: 404,
      w: 210,
      h: 1,
      style: { color: border },
    },
    {
      id: "fm_bless",
      type: "static",
      label: "تقبل اللہ منکم صالح الاعمال",
      x: 30,
      y: 460,
      w: 499,
      h: 24,
      style: {
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
        color: primary,
        fontFamily: "serif",
        direction: "rtl",
      },
    },
  ];
}
