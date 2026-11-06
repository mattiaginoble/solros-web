"use client";
import { IconButton } from "@/components/ui/controls";
import { IconFit, IconGrid, IconMinus, IconPlus, IconRuler } from "@/components/ui/icons";
import { fitToFloor, fitToRoom } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";

export function ZoomControls() {
  const { scale, zoomBy, showGrid, showDimensions, toggleGrid, toggleDimensions } = useView2D();
  const mode = useEditor((s) => s.mode);
  const focused = useEditor((s) => s.focusedRoomId);
  // Scala approssimata a schermo: 1 cm reale = `scale` px, e 96 px ≈ 2,54 cm.
  const ratio = 96 / (2.54 * scale);
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-[6px] border border-line-strong bg-panel/95 p-1">
      <IconButton label="Mostra griglia" active={showGrid} onClick={toggleGrid}>
        <IconGrid size={18} />
      </IconButton>
      <IconButton label="Mostra quote" active={showDimensions} onClick={toggleDimensions}>
        <IconRuler size={18} />
      </IconButton>
      <span className="mx-1 h-5 w-px bg-line" />
      <IconButton label="Riduci" onClick={() => zoomBy(1 / 1.25)}>
        <IconMinus size={18} />
      </IconButton>
      <span className="w-14 text-center text-xs tabular-nums text-muted" title="Scala approssimata a schermo">
        1:{Math.max(1, Math.round(ratio))}
      </span>
      <IconButton label="Ingrandisci" onClick={() => zoomBy(1.25)}>
        <IconPlus size={18} />
      </IconButton>
      <IconButton
        label="Inquadra tutto"
        onClick={() => (mode === "room" && focused ? fitToRoom(focused) : fitToFloor())}
      >
        <IconFit size={18} />
      </IconButton>
    </div>
  );
}
