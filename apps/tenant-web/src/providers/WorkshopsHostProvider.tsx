import React from "react";
import { configureWorkshopsHost } from "@mms/mod-workshops/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useCurrency } from "@/hooks/useCurrency";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import * as workshopsCollection from "@/tenant/hooks/collections/workshops";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";
import { printTemplateDocument } from "@/components/template-editor/templateDocumentPrint";
import { printHtmlDocument } from "@/lib/ui/printHtmlDocument";
import * as printBrandingTokens from "@/lib/ui/printBrandingTokens";
import ContactPicker from "@/components/contactLink/ContactPicker";

/** Binds the app workshops queries, print helpers and template preview into the module host. */
export function WorkshopsHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  configureWorkshopsHost({
    usePermissions,
    useModulePermissions,
    useCurrency,
    useGenericModuleExport,
    workshopsCollection: workshopsCollection as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >,
    TemplateDocumentPreview: TemplateDocumentPreview as unknown as React.ComponentType<
      Record<string, never>
    >,
    ContactPicker: ContactPicker as unknown as React.ComponentType<Record<string, never>>,
    printTemplateDocument,
    printHtmlDocument,
    printBrandingTokens: printBrandingTokens as unknown as Record<string, string>,
  });
  return <>{children}</>;
}
