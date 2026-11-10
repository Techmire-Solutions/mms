import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Numeric preference input that can be cleared while typing but never commits an invalid number.
 *
 * `Input type="number"` with `min`/`max` only hints at the browser: `Number("")` is `0`, so an emptied
 * field used to persist a threshold of 0. This keeps the raw text, restores the previous value on an
 * empty blur, and clamps (and rounds) everything else into the allowed range.
 */
export function useClampedNumberField(args: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}): {
  text: string;
  setText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
} {
  const { value, min, max, onChange } = args;
  const [text, setTextState] = useState(String(value));
  const focused = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // External updates (discard, refetch) must not fight the field the user is typing in.
  useEffect(() => {
    if (!focused.current) setTextState(String(value));
  }, [value]);

  const setText = useCallback((next: string) => setTextState(next), []);
  const onFocus = useCallback(() => {
    focused.current = true;
  }, []);
  const onBlur = useCallback(() => {
    focused.current = false;
    const parsed = Number(text);
    if (!text.trim() || !Number.isFinite(parsed)) {
      setTextState(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    onChangeRef.current(clamped);
    setTextState(String(clamped));
  }, [max, min, text, value]);

  return { text, setText, onFocus, onBlur };
}
