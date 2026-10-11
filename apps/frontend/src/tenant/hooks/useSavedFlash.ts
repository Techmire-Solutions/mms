import { useEffect, useRef, useState } from "react";

const SAVED_FLASH_MS = 2500;

/** Brief “saved” indicator for settings panels after a successful persist. */
export function useSavedFlash(): {
  saved: boolean;
  flashSaved: () => void;
  clearSaved: () => void;
} {
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flashSaved = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaved(true);
    timerRef.current = setTimeout(() => {
      setSaved(false);
      timerRef.current = null;
    }, SAVED_FLASH_MS);
  };

  const clearSaved = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setSaved(false);
  };

  return { saved, flashSaved, clearSaved };
}
