import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { isEventInsideEditor } from "./templateEditorShortcutUtils";

export function useTemplateEditorPan(
  canvasViewportRef?: RefObject<HTMLElement | null>,
  editorId?: string,
) {
  const panState = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEventInsideEditor(e, editorId)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        const interactive = target?.closest(
          'button, a[href], [role="button"], summary, [contenteditable="true"]',
        );
        if (interactive) return;
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    const handleBlur = () => {
      setIsSpacePressed(false);
      setIsPanning(false);
      panState.current = null;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [editorId]);

  const onPointerDownViewport = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.button === 1 || isSpacePressed) && canvasViewportRef?.current) {
      event.preventDefault();
      panState.current = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: canvasViewportRef.current.scrollLeft,
        scrollTop: canvasViewportRef.current.scrollTop,
      };
      setIsPanning(true);
    }
  };

  const handlePanMove = (event: PointerEvent): boolean => {
    if (!panState.current || !canvasViewportRef?.current) return false;
    const dx = event.clientX - panState.current.startX;
    const dy = event.clientY - panState.current.startY;
    canvasViewportRef.current.scrollLeft = panState.current.scrollLeft - dx;
    canvasViewportRef.current.scrollTop = panState.current.scrollTop - dy;
    return true;
  };

  const handlePanEnd = () => {
    panState.current = null;
    setIsPanning(false);
  };

  return {
    isSpacePressed,
    isPanning,
    onPointerDownViewport,
    handlePanMove,
    handlePanEnd,
  };
}
