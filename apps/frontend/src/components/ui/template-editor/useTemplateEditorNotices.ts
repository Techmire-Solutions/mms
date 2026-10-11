import { useCallback, useEffect, useRef, useState } from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const FLASH_DURATION_MS = 1600;
const DELETION_NOTICE_MS = 4000;

export interface UseTemplateEditorNoticesOptions {
  t: TranslationFunction;
}

export function useTemplateEditorNotices({ t }: UseTemplateEditorNoticesOptions) {
  const [flashElementId, setFlashElementId] = useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = useState<{ nonce: number; message: string } | null>(
    null,
  );

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (deletionTimerRef.current) clearTimeout(deletionTimerRef.current);
    };
  }, []);

  const handleElementAdded = useCallback((elementId: string) => {
    setFlashElementId(elementId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashElementId(null), FLASH_DURATION_MS);
  }, []);

  const handleElementDeleted = useCallback(
    (deletedCount: number) => {
      setDeletionNotice((prev) => ({
        nonce: (prev?.nonce ?? 0) + 1,
        message: `${t("templateEditor.elementDeleted")} (${deletedCount})`,
      }));
      if (deletionTimerRef.current) clearTimeout(deletionTimerRef.current);
      deletionTimerRef.current = setTimeout(() => setDeletionNotice(null), DELETION_NOTICE_MS);
    },
    [t],
  );

  return {
    flashElementId,
    deletionNotice,
    handleElementAdded,
    handleElementDeleted,
  };
}
