/**
 * @file StudentCardTemplateEditor.tsx
 * @description Student ID-card front/back editor on top of the shared TemplateEditor.
 *
 * The card is one server-backed document (`elements` = front, `backElements` = back).
 * Switching sides therefore edits the same record; changing paper size must not remount
 * the editor (that used to reset undo history and the dirty baseline).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { TemplateEditor } from "@/components/app/TemplateEditor";
import { useDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { notify } from "@/lib/notify";
import type { Student } from "@mms/shared";
import type {
  CardSide,
  StudentCardPayload,
  StudentCardTemplate,
} from "../../lib/studentCardTemplateTypes";
import {
  getDefaultStudentCardBackElements,
  getDefaultStudentCardTemplate,
} from "../../lib/studentCardTemplateDefaults";
import { getAvailableStudentCardPresets } from "../../lib/studentCardTemplatePresets";
import {
  AVAILABLE_STUDENT_CARD_FIELDS,
  STUDENT_CARD_TEMPLATE_KEY,
  useSaveStudentCardTemplate,
} from "../../lib/studentCardTemplateStore";
import { useStudentCardSampleData } from "./useStudentCardSampleData";
import { StudentCardSideSwitcher } from "./StudentCardSideSwitcher";

export interface StudentCardTemplateEditorProps {
  onClose: () => void;
  /** Reports unsaved layout changes to the Setup leave-guard. */
  onDirtyChange?: (dirty: boolean) => void;
  fullscreen?: boolean;
  sampleStudent?: Student | null;
  sessionNames?: string[];
  guardianName?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
}

export function StudentCardTemplateEditor({
  onClose,
  onDirtyChange,
  fullscreen = true,
  sampleStudent = null,
  sessionNames = [],
  guardianName,
  emergencyPhone,
  bloodGroup,
}: StudentCardTemplateEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const branding = useBranding();
  const [activeSide, setActiveSide] = useState<CardSide>("front");
  // The editor reports dirtiness; only a *pristine* card adopts a late server layout.
  const dirtyRef = useRef(false);

  const defaultFullTemplate = useMemo<StudentCardTemplate>(
    () => getDefaultStudentCardTemplate(branding),
    [branding],
  );

  const { template: storedFullTemplate } = useDocumentTemplate<StudentCardPayload>(
    STUDENT_CARD_TEMPLATE_KEY,
    defaultFullTemplate,
  );

  // Keep both sides in one record. Server updates (initial fetch, another tab, WS
  // invalidation) are adopted only while the user has not touched the card.
  const [fullTemplate, setFullTemplate] = useState<StudentCardTemplate>(storedFullTemplate);
  useEffect(() => {
    if (!dirtyRef.current) setFullTemplate(storedFullTemplate);
  }, [storedFullTemplate]);

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      dirtyRef.current = dirty;
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  const availableFields = useMemo(
    () =>
      AVAILABLE_STUDENT_CARD_FIELDS.map((field) => ({
        ...field,
        label:
          t(`students.cardTemplate.field.${field.field}` as Parameters<typeof t>[0]) || field.label,
      })),
    [t],
  );

  const sampleData = useStudentCardSampleData({
    branding,
    sampleStudent,
    sessionNames,
    guardianName,
    emergencyPhone,
    bloodGroup,
    t,
  });

  const presets = useMemo(() => {
    return getAvailableStudentCardPresets(branding).map((p) => ({
      key: p.key,
      label: t(p.nameKey as Parameters<typeof t>[0]) || p.label,
      template: {
        ...p.template,
        elements:
          activeSide === "front"
            ? p.template.elements
            : p.template.backElements && p.template.backElements.length > 0
              ? p.template.backElements
              : getDefaultStudentCardBackElements(branding),
      },
    }));
  }, [branding, t, activeSide]);

  // Current active side template passed to TemplateEditor
  const activeSideTemplate = useMemo<StudentCardTemplate>(() => {
    if (activeSide === "back") {
      const backElements =
        fullTemplate.backElements && fullTemplate.backElements.length > 0
          ? fullTemplate.backElements
          : getDefaultStudentCardBackElements(branding);
      return {
        ...fullTemplate,
        elements: backElements,
      };
    }
    return fullTemplate;
  }, [fullTemplate, activeSide, branding]);

  const activeSideDefaultTemplate = useMemo<StudentCardTemplate>(() => {
    if (activeSide === "back") {
      return {
        ...defaultFullTemplate,
        elements: getDefaultStudentCardBackElements(branding),
      };
    }
    return defaultFullTemplate;
  }, [defaultFullTemplate, activeSide, branding]);

  const { mutateAsync: saveCardTemplate } = useSaveStudentCardTemplate();

  const handleSave = useCallback(
    async (currentSideTmpl: StudentCardTemplate): Promise<void> => {
      const updatedFullTemplate: StudentCardTemplate = {
        ...fullTemplate,
        pageSize: currentSideTmpl.pageSize,
        orientation: currentSideTmpl.orientation,
        ...(activeSide === "front"
          ? { elements: currentSideTmpl.elements }
          : { backElements: currentSideTmpl.elements }),
      };

      await saveCardTemplate(updatedFullTemplate);
      setFullTemplate(updatedFullTemplate);
      notify.success(t("students.idCard.templateSaved"));
    },
    [fullTemplate, activeSide, saveCardTemplate, t],
  );

  const handleSideTemplateChange = useCallback(
    (currentSideTmpl: StudentCardTemplate) => {
      setFullTemplate((prev) => ({
        ...prev,
        pageSize: currentSideTmpl.pageSize,
        orientation: currentSideTmpl.orientation,
        ...(activeSide === "front"
          ? { elements: currentSideTmpl.elements }
          : { backElements: currentSideTmpl.elements }),
      }));
    },
    [activeSide],
  );

  const sideLabel =
    activeSide === "front"
      ? t("students.cardTemplate.side.front")
      : t("students.cardTemplate.side.back");

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Side Switcher Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{t("students.cardTemplate.title")}</span>
          <span className="text-muted-foreground">({sideLabel})</span>
        </div>
        <StudentCardSideSwitcher activeSide={activeSide} onSelectSide={setActiveSide} t={t} />
      </div>

      <div className="flex-1 min-h-0">
        <TemplateEditor<StudentCardPayload>
          key={`card-editor-${activeSide}`}
          title={`${t("students.cardTemplate.title")} (${sideLabel})`}
          template={activeSideTemplate}
          defaultTemplate={activeSideDefaultTemplate}
          availableFields={availableFields}
          presets={presets}
          documentType="student-card"
          sampleData={sampleData}
          fullscreen={fullscreen}
          branding={branding}
          onChange={handleSideTemplateChange}
          onSave={handleSave}
          onClose={onClose}
          onDirtyChange={handleDirtyChange}
        />
      </div>
    </div>
  );
}

export default StudentCardTemplateEditor;
