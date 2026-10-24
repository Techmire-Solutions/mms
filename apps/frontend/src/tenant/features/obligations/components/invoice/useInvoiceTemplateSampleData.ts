import { useMemo } from "react";
import {
  AVAILABLE_FIELDS,
  indexLookups,
  resolveField,
  type InvoiceReceiptPayload,
} from "@/lib/invoiceTemplateStore";
import {
  DEFAULT_CURRENCIES,
  formatBrandingAddress,
  todayISO,
  type BrandingSettings,
  type Mujtahid,
  type MujtahidRep,
  type ObligationCollection,
  type ObligationType,
} from "@mms/shared";
import type {
  useMergedObligationContacts,
  useMergedObligationUsers,
} from "@/tenant/features/obligations/hooks/useObligationLookups";

interface UseInvoiceTemplateSampleDataOptions {
  collection?: ObligationCollection | null;
  branding: BrandingSettings;
  liveContacts: ReturnType<typeof useMergedObligationContacts>;
  liveUsers: ReturnType<typeof useMergedObligationUsers>;
  obligationTypes: ObligationType[];
  mujtahids: Mujtahid[];
  reps: MujtahidRep[];
}

export function useInvoiceTemplateSampleData({
  collection,
  branding,
  liveContacts,
  liveUsers,
  obligationTypes,
  mujtahids,
  reps,
}: UseInvoiceTemplateSampleDataOptions): InvoiceReceiptPayload {
  const defaultSampleData = useMemo<InvoiceReceiptPayload>(() => {
    const institutionAddress = formatBrandingAddress(branding) || "123 Seminary Road, Karachi";
    const madrasaName = branding.madrasaName || "Madrasa Management System";

    return {
      institution: madrasaName,
      institution_name: madrasaName,
      institution_phone: branding.phone || "+92 21 34567890",
      institution_email: branding.email || "office@alhuda.edu",
      institution_address: institutionAddress,
      receipt_no: "REC-2026-0042",
      received_date: todayISO(),
      sender: "Muhammad Ali Raza",
      sender_phone: "+92 300 1234567",
      sender_email: "ali.raza@example.com",
      reference: "Sayyid Kazim Hosseini",
      reference_phone: "+92 321 9876543",
      reference_email: "kazim.ref@example.com",
      obligation_type: "Khums (Sahm-e-Imam)",
      mujtahid: "Ayatullah al-Uzma Sistani",
      representative: "Maulana Baqir Zaidi",
      amount: "PKR 75,000.00",
      amount_in_words: "Seventy Five Thousand Rupees Only",
      currency: "PKR",
      payment_mode: "Bank Transfer",
      received_by: "Admin Office",
    };
  }, [branding]);

  return useMemo<InvoiceReceiptPayload>(() => {
    if (!collection) return defaultSampleData;

    const indexedLookups = indexLookups({
      contacts: liveContacts,
      users: liveUsers,
      currencies: DEFAULT_CURRENCIES,
      obligationTypes,
      mujtahids,
      reps,
      branding,
    });

    const record: Record<string, unknown> = { ...collection };
    const data: InvoiceReceiptPayload = { ...defaultSampleData };
    for (const item of AVAILABLE_FIELDS) {
      const val = resolveField(item.field, record, indexedLookups);
      if (val !== undefined && val !== null && val !== "") {
        data[item.field] = val;
      }
    }
    return data;
  }, [
    collection,
    defaultSampleData,
    liveContacts,
    liveUsers,
    obligationTypes,
    mujtahids,
    reps,
    branding,
  ]);
}
