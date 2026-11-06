"use client";
import { useEffect, useState } from "react";
import { Image as KImage, Layer } from "react-konva";
import type { FloorplanBackground } from "@/domain/schema";
import { useEditor } from "@/store/editor";
import { setBackground } from "@/store/floorplan";

/** Planimetria importata, disegnata come sfondo semitrasparente sotto le stanze. */
export function BackgroundLayer({ bg }: { bg: FloorplanBackground | null | undefined }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const tool = useEditor((s) => s.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const src = bg?.src;
  useEffect(() => {
    if (!src) return;
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);
  if (!bg || !bg.visible || !img || img.src !== bg.src) return null;
  const draggable = !bg.locked && tool === "select" && !readOnly;
  return (
    <Layer listening={draggable}>
      <KImage
        image={img}
        x={bg.x}
        y={bg.y}
        width={bg.pixelWidth * bg.cmPerPixel}
        height={bg.pixelHeight * bg.cmPerPixel}
        opacity={bg.opacity}
        draggable={draggable}
        onDragStart={(e) => {
          e.cancelBubble = true;
          useEditor.getState().begin();
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          setBackground({ ...bg, x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
          useEditor.getState().commit();
        }}
      />
    </Layer>
  );
}
