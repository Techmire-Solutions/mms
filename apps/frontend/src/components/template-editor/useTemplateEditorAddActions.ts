/**
 * @file useTemplateEditorAddActions.ts
 * @description Sub-hook providing element creation operations for text, heading, divider, field, QR code, logo, and table.
 */

import { useCallback, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { PageSizeInfo, TemplateElement, TemplateFieldDefinition } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  createDividerElement,
  createFieldElement,
  createHeadingElement,
  createLogoElement,
  createQrCodeElement,
  createStaticTextElement,
  createTableElement,
  findInsertionPos,
} from "./templateEditorElementFactories";

export interface UseTemplateEditorAddActionsOptions<TPayload = Record<string, unknown>> {
  elementsRef: RefObject<TemplateElement<keyof TPayload & string>[]>;
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  commitUpdate: (
    updateFn: (
      elements: TemplateElement<keyof TPayload & string>[],
    ) => TemplateElement<keyof TPayload & string>[],
  ) => void;
  size: PageSizeInfo;
  onElementAdded?: (elementId: string) => void;
  t: TranslationFunction;
}

export function useTemplateEditorAddActions<TPayload = Record<string, unknown>>({
  elementsRef,
  setSelectedIds,
  commitUpdate,
  size,
  onElementAdded,
  t,
}: UseTemplateEditorAddActionsOptions<TPayload>) {
  const getInsertionPos = useCallback(
    (w: number, h: number) => findInsertionPos(elementsRef.current, w, h, size),
    [elementsRef, size],
  );

  const addElement = useCallback(
    (el: TemplateElement<keyof TPayload & string>) => {
      commitUpdate((els) => [...els, el]);
      setSelectedIds([el.id]);
      onElementAdded?.(el.id);
    },
    [commitUpdate, onElementAdded, setSelectedIds],
  );

  const addStaticText = useCallback(() => {
    const { x, y } = getInsertionPos(200, 18);
    addElement(
      createStaticTextElement(x, y, t("templateEditor.newText")) as TemplateElement<
        keyof TPayload & string
      >,
    );
  }, [addElement, getInsertionPos, t]);

  const addHeading = useCallback(() => {
    const w = Math.min(320, Math.max(160, size.width - 40));
    const h = 26;
    const { x, y } = getInsertionPos(w, h);
    addElement(
      createHeadingElement(x, y, w, t("templateEditor.heading")) as TemplateElement<
        keyof TPayload & string
      >,
    );
  }, [addElement, getInsertionPos, size.width, t]);

  const addDivider = useCallback(() => {
    const w = Math.max(40, size.width - 40);
    const h = 1;
    const { x, y } = getInsertionPos(w, h);
    addElement(createDividerElement(x, y, w) as TemplateElement<keyof TPayload & string>);
  }, [addElement, getInsertionPos, size.width]);

  const addField = useCallback(
    (fieldDef: TemplateFieldDefinition<TPayload>) => {
      const { x, y } = getInsertionPos(160, 16);
      addElement(createFieldElement(x, y, fieldDef));
    },
    [addElement, getInsertionPos],
  );

  const addQrCode = useCallback(() => {
    const { x, y } = getInsertionPos(64, 64);
    addElement(
      createQrCodeElement(x, y, t("templateEditor.qrCode")) as TemplateElement<
        keyof TPayload & string
      >,
    );
  }, [addElement, getInsertionPos, t]);

  const addLogo = useCallback(() => {
    const { x, y } = getInsertionPos(80, 80);
    addElement(
      createLogoElement(x, y, t("templateEditor.logo")) as TemplateElement<keyof TPayload & string>,
    );
  }, [addElement, getInsertionPos, t]);

  const addTable = useCallback(() => {
    const w = Math.min(500, Math.max(240, size.width - 40));
    const h = 120;
    const { x, y } = getInsertionPos(w, h);
    addElement(
      createTableElement(x, y, w, {
        label: t("templateEditor.table"),
        columnIndex: t("templateEditor.columnIndex"),
        columnDescription: t("templateEditor.columnDescription"),
        columnAmount: t("templateEditor.columnAmount"),
      }) as TemplateElement<keyof TPayload & string>,
    );
  }, [addElement, getInsertionPos, size.width, t]);

  return {
    addElement,
    addStaticText,
    addHeading,
    addDivider,
    addField,
    addQrCode,
    addLogo,
    addTable,
  };
}
