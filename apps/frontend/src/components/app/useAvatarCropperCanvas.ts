import { useEffect, useRef, useState } from "react";

interface DragCoordinate {
  x: number;
  y: number;
}

const SIZE = 280;
const RADIUS = SIZE / 2;

export function useAvatarCropperCanvas(src: string) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<DragCoordinate>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<DragCoordinate | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      const fit = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
      setScale(fit);
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!imgEl || !canvasRef.current) return;
    const canvasContext = canvasRef.current.getContext("2d");
    if (!canvasContext) return;
    canvasContext.clearRect(0, 0, SIZE, SIZE);
    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
    canvasContext.clip();
    canvasContext.translate(RADIUS + offset.x, RADIUS + offset.y);
    canvasContext.rotate((rotation * Math.PI) / 180);
    canvasContext.scale(scale, scale);
    canvasContext.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);
    canvasContext.restore();
    canvasContext.save();
    canvasContext.strokeStyle = "rgba(255,255,255,0.9)";
    canvasContext.lineWidth = 3;
    canvasContext.beginPath();
    canvasContext.arc(RADIUS, RADIUS, RADIUS - 2, 0, Math.PI * 2);
    canvasContext.stroke();
    canvasContext.restore();
    canvasContext.save();
    canvasContext.fillStyle = "rgba(0,0,0,0.45)";
    canvasContext.fillRect(0, 0, SIZE, SIZE);
    canvasContext.globalCompositeOperation = "destination-out";
    canvasContext.beginPath();
    canvasContext.arc(RADIUS, RADIUS, RADIUS - 2, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();
  }, [imgEl, scale, rotation, offset]);

  const onMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    setDragging(true);
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  };

  const onMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!dragging || !dragStart) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  };

  const onMouseUp = (): void => {
    setDragging(false);
  };

  const onTouchStart = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    const touch = event.touches[0];
    setDragging(true);
    setDragStart({ x: touch.clientX - offset.x, y: touch.clientY - offset.y });
  };

  const onTouchMove = (event: React.TouchEvent<HTMLCanvasElement>): void => {
    if (!dragging || !dragStart) return;
    const touch = event.touches[0];
    setOffset({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
  };

  const resetTransform = (): void => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const rotateCounterClockwise = (): void => {
    setRotation((prevRotation) => prevRotation - 90);
  };

  const adjustScaleFromWheel = (deltaY: number): void => {
    setScale((prevScale) => Math.min(5, Math.max(0.3, prevScale - deltaY * 0.002)));
  };

  const renderCroppedCanvas = (): HTMLCanvasElement | null => {
    if (!imgEl) return null;
    const OUT = 300;
    const out = document.createElement("canvas");
    out.width = OUT;
    out.height = OUT;
    const canvasContext = out.getContext("2d");
    if (!canvasContext) return null;

    canvasContext.save();
    canvasContext.beginPath();
    canvasContext.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    canvasContext.clip();

    const ratio = OUT / SIZE;
    canvasContext.translate(OUT / 2 + offset.x * ratio, OUT / 2 + offset.y * ratio);
    canvasContext.rotate((rotation * Math.PI) / 180);
    canvasContext.scale(scale * ratio, scale * ratio);
    canvasContext.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);
    canvasContext.restore();

    return out;
  };

  return {
    canvasRef,
    scale,
    setScale,
    dragging,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    resetTransform,
    rotateCounterClockwise,
    adjustScaleFromWheel,
    renderCroppedCanvas,
    previewSize: SIZE,
  };
}
