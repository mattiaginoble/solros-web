"use client";
/**
 * Pianta 2D (Konva). Coordinate dello stage = cm del piano; la vista
 * (scala e traslazione) vive in useView2D. Gestisce pan, zoom con rotella e
 * pinch, gli strumenti (selezione, disegno muri, aperture) e il rilascio dalla
 * barra strumenti tramite drag & drop.
 */
import Konva from "konva";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Layer, Line, Stage } from "react-konva";
import { createRoom } from "@/domain/factory";
import { addOpeningAtWorld, addRoom, copyRoomsFromBelow, fitToFloor, fitToRoom, placeProductAtWorld } from "@/store/actions";
import { adjacentFloor } from "@/domain/floors";
import { activeFloor, useEditor } from "@/store/editor";
import { useView2D } from "@/store/view2d";
import { cleanPolygon, area, isSelfIntersecting, offsetPolygon } from "@/lib/geometry/polygon";
import { snapDrawPoint, snapValue } from "@/lib/geometry/snap";
import { roomWorldPolygon } from "@/lib/geometry/transform";
import { computeFloorWalls, openingGeometries, type FloorWalls } from "@/lib/geometry/walls";
import { applyMatchThickness, snapRoomPosition, type EdgeMatch } from "@/lib/geometry/houseSnap";
import { type Vec2, add, distance, mul, normalize, sub } from "@/lib/geometry/vec";
import { ProductSchema, type OpeningKind, type Room } from "@/domain/schema";
import { GridLayer } from "./GridLayer";
import { PlanRoomLabels, PlanRooms, RoomSelectionOutline, type RoomDragHandlers } from "./PlanRooms";
import { PlanWalls } from "./PlanWalls";
import { OpeningDimensions, RoomDimensions } from "./PlanDimensions";
import { PlanHandles } from "./PlanHandles";
import { DrawOverlay, emptyDraw, type DrawState } from "./DrawOverlay";
import { ZoomControls } from "./ZoomControls";
import { OPENING_DND_TYPE, PRODUCT_DND_TYPE } from "./dnd";
import { PlanItems } from "./PlanItems";
import { PlanGhosts } from "./PlanGhosts";
import { BackgroundLayer } from "./BackgroundLayer";
import { CalibrationPanel, CalibrationShapes } from "./CalibrationOverlay";
import { backgroundSnapLines } from "@/floorplan/client";
import type { SnapLine } from "@/lib/geometry/snap";

Konva.hitOnDragEnabled = true;

const TOOL_HINTS: Record<string, string> = {
  draw: "Clic per aggiungere un vertice. Digita una misura e premi Invio per un lato esatto. Clic sul primo punto o doppio clic per chiudere. Alt disattiva lo snap, Esc annulla.",
  door: "Clicca su un muro per inserire la porta, oppure trascinala dalla barra.",
  window: "Clicca su un muro per inserire la finestra, oppure trascinala dalla barra.",
  passage: "Clicca su un muro per aprire un passaggio.",
};

export default function Plan2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const view = useView2D();
  const house = useEditor((s) => s.house);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const floor = useMemo(() => activeFloor({ house, activeFloorId }), [house, activeFloorId]);
  const mode = useEditor((s) => s.mode);
  const focusedRoomId = useEditor((s) => s.focusedRoomId);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const readOnly = useEditor((s) => s.readOnly);
  const grid = house.settings.gridSize;

  const walls = useMemo(() => computeFloorWalls(floor.rooms), [floor.rooms]);
  const openings = useMemo(() => openingGeometries(floor.rooms, walls), [floor.rooms, walls]);
  const [draw, setDraw] = useState<DrawState>(emptyDraw);
  const [, setFontsReady] = useState(false);
  const [ready, setReady] = useState(false);
  const pinch = useRef<{ dist: number; center: Vec2 } | null>(null);
  const [calib, setCalib] = useState<{ points: Vec2[]; cursor: Vec2 | null }>({ points: [], cursor: null });
  const [bgLines, setBgLines] = useState<SnapLine[]>([]);
  const background = floor.background ?? null;

  // Facce dei muri della planimetria, per lo snap durante il ricalco e la calibrazione.
  useEffect(() => {
    let alive = true;
    if (!background || !background.visible || (tool !== "draw" && tool !== "calibrate")) return;
    backgroundSnapLines(background).then((r) => {
      if (alive) setBgLines(r.lines);
    });
    return () => {
      alive = false;
    };
  }, [background, tool]);

  const focusedRoom = focusedRoomId ? floor.rooms.find((r) => r.id === focusedRoomId) ?? null : null;
  const dimmed = useMemo(
    () => new Set(mode === "room" && focusedRoomId ? floor.rooms.filter((r) => r.id !== focusedRoomId).map((r) => r.id) : []),
    [mode, focusedRoomId, floor.rooms],
  );

  // Dimensioni del contenitore.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      useView2D.getState().setViewport(el.clientWidth, el.clientHeight);
      setReady(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.fonts?.ready.then(() => setFontsReady(true));
  }, []);

  // Inquadra la casa all'apertura del progetto e al cambio di piano.
  useEffect(() => {
    if (!ready) return;
    const f = activeFloor(useEditor.getState());
    if (f.rooms.length) fitToFloor();
    else useView2D.getState().setView({ scale: 0.8, x: 120, y: 120 });
  }, [ready, house.id, activeFloorId]);

  // Uscendo dallo strumento di disegno si azzera il tracciato.
  const [prevTool, setPrevTool] = useState(tool);
  if (prevTool !== tool) {
    setPrevTool(tool);
    if (tool !== "draw") setDraw(emptyDraw());
  }

  const snapCandidates = useMemo(() => {
    const pts: Vec2[] = [];
    for (const r of floor.rooms) {
      const inner = roomWorldPolygon(r);
      pts.push(...inner, ...offsetPolygon(inner, r.walls.map((w) => w.thickness)));
    }
    return pts;
  }, [floor.rooms]);

  const finishDraw = useCallback(
    (points: Vec2[]) => {
      const st = useEditor.getState();
      const poly = cleanPolygon(points);
      if (poly.length < 3) {
        st.notify("Servono almeno tre vertici per chiudere una stanza", "warning");
        return;
      }
      if (isSelfIntersecting(poly)) {
        st.notify("I muri si incrociano: correggi il tracciato prima di chiuderlo", "error");
        return;
      }
      if (area(poly) < 5000) {
        st.notify("La stanza è troppo piccola (minimo 0,5 m²)", "warning");
        return;
      }
      const count = activeFloor(st).rooms.length;
      const room = createRoom({
        polygon: poly,
        name: `Stanza ${count + 1}`,
        wallThickness: st.house.settings.defaultWallThickness,
        ceilingHeight: st.house.settings.defaultCeilingHeight,
      });
      addRoom(room, { place: "keep", focus: true });
      st.setTool("select");
      setDraw(emptyDraw());
      requestAnimationFrame(() => fitToRoom(room.id));
    },
    [],
  );

  // Stato del disegno sempre aggiornato per i gestori di eventi (evita chiusure su dati vecchi).
  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  const lastClick = useRef<{ t: number; x: number; y: number } | null>(null);

  const addDrawPoint = useCallback(
    (p: Vec2, finish: boolean) => {
      const d = drawRef.current;
      if (finish && d.points.length >= 3) {
        finishDraw(d.points);
        return;
      }
      const last = d.points[d.points.length - 1];
      if (last && distance(last, p) < 0.5) return;
      const next = { ...d, points: [...d.points, p], typed: "" };
      drawRef.current = next;
      setDraw(next);
    },
    [finishDraw],
  );

  // Tastiera durante il disegno: misura numerica, Invio, Esc, Backspace.
  useEffect(() => {
    if (tool !== "draw") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const d = draw;
      if (/^[0-9]$/.test(e.key) || ((e.key === "," || e.key === ".") && !d.typed.includes("."))) {
        if (d.points.length === 0) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        setDraw({ ...d, typed: d.typed + (e.key === "," ? "." : e.key) });
      } else if (e.key === "Backspace") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (d.typed) setDraw({ ...d, typed: d.typed.slice(0, -1) });
        else setDraw({ ...d, points: d.points.slice(0, -1) });
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const len = Number(d.typed);
        const last = d.points[d.points.length - 1];
        if (d.typed && last && d.cursor && len > 0) {
          const dir = normalize(sub(d.cursor, last));
          const p = add(last, mul(dir.x === 0 && dir.y === 0 ? { x: 1, y: 0 } : dir, len));
          setDraw({ ...d, points: [...d.points, p], typed: "", cursor: p });
        } else if (d.points.length >= 3) finishDraw(d.points);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (d.typed) setDraw({ ...d, typed: "" });
        else if (d.points.length) setDraw(emptyDraw());
        else useEditor.getState().setTool("select");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tool, draw, finishDraw]);

  const worldPointer = (): Vec2 | null => stageRef.current?.getRelativePointerPosition() ?? null;

  const updateDrawCursor = (free: boolean) => {
    const raw = worldPointer();
    if (!raw) return;
    const res = snapDrawPoint(raw, draw.points, snapCandidates, {
      grid,
      tolerance: 10 / view.scale,
      free,
      lines: background?.visible ? bgLines : undefined,
    });
    setDraw((d) => ({ ...d, cursor: res.point, guides: res.guides, closes: res.closes }));
  };

  const onStagePointer = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = useEditor.getState();
    if (tool === "draw") {
      const raw = worldPointer();
      const screen = stage.getPointerPosition();
      if (!raw || !screen) return;
      // Doppio clic (stesso punto, entro 400 ms) per chiudere la stanza.
      const now = performance.now();
      const prev = lastClick.current;
      const isDouble = !!prev && now - prev.t < 400 && Math.hypot(screen.x - prev.x, screen.y - prev.y) < 6;
      lastClick.current = isDouble ? null : { t: now, x: screen.x, y: screen.y };
      const free = "altKey" in e.evt ? e.evt.altKey : false;
      const res = snapDrawPoint(raw, drawRef.current.points, snapCandidates, {
        grid,
        tolerance: 12 / view.scale,
        free,
        lines: background?.visible ? bgLines : undefined,
      });
      addDrawPoint(res.point, res.closes || isDouble);
      return;
    }
    if (tool === "calibrate") {
      const raw = worldPointer();
      if (!raw) return;
      const free = "altKey" in e.evt ? e.evt.altKey : false;
      const p = free || !bgLines.length ? raw : snapDrawPoint(raw, [], [], { grid: 0.1, tolerance: 10 / view.scale, lines: bgLines }).point;
      setCalib((c) => (c.points.length >= 2 ? { points: [p], cursor: null } : { ...c, points: [...c.points, p] }));
      return;
    }
    if (tool === "door" || tool === "window" || tool === "passage") {
      const p = worldPointer();
      if (!p) return;
      const created = addOpeningAtWorld(tool as OpeningKind, p, {
        roomId: st.mode === "room" ? (st.focusedRoomId ?? undefined) : undefined,
      });
      if (created) st.setTool("select");
      return;
    }
    if (e.target === stage) {
      st.select(st.mode === "room" && st.focusedRoomId ? { kind: "room", roomId: st.focusedRoomId } : null);
    }
  };

  // Trascinamento stanze (modalità casa) con snap magnetico ai muri delle altre stanze.
  const dragStart = useRef<Room | null>(null);
  const altDown = useRef(false);
  const [snapMatches, setSnapMatches] = useState<EdgeMatch[]>([]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => (altDown.current = e.altKey);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", down);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", down);
    };
  }, []);
  const roomDrag: RoomDragHandlers = {
    onDragStart: (room) => {
      dragStart.current = room;
      useEditor.getState().begin();
    },
    onDragMove: (room, pos) => {
      const st = useEditor.getState();
      const others = activeFloor(st).rooms.filter((r) => r.id !== room.id);
      let snapped = { x: snapValue(pos.x, grid), y: snapValue(pos.y, grid) };
      let matches: EdgeMatch[] = [];
      if (!altDown.current) {
        const res = snapRoomPosition(room, pos, others, Math.max(6, 16 / view.scale));
        if (res.matches.length) {
          // Lungo gli assi non agganciati resta lo snap alla griglia.
          snapped = { x: res.x, y: res.y };
          matches = res.matches;
        }
      }
      setSnapMatches(matches);
      st.updateRoom(room.id, (r) => (r.x === snapped.x && r.y === snapped.y ? r : { ...r, ...snapped }));
      return snapped;
    },
    onDragEnd: (room) => {
      const st = useEditor.getState();
      const facing = snapMatches.filter((m) => m.kind === "facing");
      if (facing.length) {
        const floorIdx = st.house.floors.findIndex((f) => f.id === st.activeFloorId);
        const merged = applyMatchThickness(activeFloor(st).rooms, facing);
        st.apply((h) => {
          h.floors[floorIdx].rooms = merged;
        });
        const names = facing
          .map((m) => activeFloor(st).rooms.find((r) => r.id === m.target.roomId)?.name)
          .filter(Boolean)
          .join(", ");
        st.notify(`${room.name} e ${names} ora condividono un muro`);
      }
      setSnapMatches([]);
      dragStart.current = null;
      st.commit();
    },
  };

  const selectedRoom =
    selection && floor.rooms.find((r) => r.id === selection.roomId && selection.kind === "room");
  const selectedOpening =
    selection?.kind === "opening"
      ? (() => {
          const r = floor.rooms.find((x) => x.id === selection.roomId);
          const o = r?.openings.find((x) => x.id === selection.openingId);
          return r && o ? { room: r, opening: o } : null;
        })()
      : null;

  const interactiveRooms = tool === "select";
  const roomsDraggable = interactiveRooms && mode === "house" && !readOnly;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ cursor: tool === "draw" ? "crosshair" : tool === "select" ? "default" : "copy" }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(OPENING_DND_TYPE) || e.dataTransfer.types.includes(PRODUCT_DND_TYPE)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        if (!stageRef.current) return;
        const kind = e.dataTransfer.getData(OPENING_DND_TYPE) as OpeningKind;
        const productJson = e.dataTransfer.getData(PRODUCT_DND_TYPE);
        if (!kind && !productJson) return;
        e.preventDefault();
        stageRef.current.setPointersPositions(e.nativeEvent);
        const p = stageRef.current.getRelativePointerPosition();
        if (!p) return;
        if (kind) addOpeningAtWorld(kind, p);
        else {
          const parsed = ProductSchema.safeParse(JSON.parse(productJson));
          if (parsed.success) placeProductAtWorld(parsed.data, p);
        }
      }}
    >
      {ready && (
        <Stage
          ref={stageRef}
          width={view.width}
          height={view.height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          draggable={tool === "select"}
          onDragMove={(e) => {
            if (e.target === stageRef.current) useView2D.getState().setView({ x: e.target.x(), y: e.target.y() });
          }}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) useView2D.getState().setView({ x: e.target.x(), y: e.target.y() });
          }}
          onWheel={(e) => {
            e.evt.preventDefault();
            const p = stageRef.current?.getPointerPosition();
            if (!p) return;
            const factor = Math.exp(-Math.max(-60, Math.min(60, e.evt.deltaY)) * 0.004);
            useView2D.getState().zoomAt(p, factor);
          }}
          onMouseMove={(e) => {
            if (tool === "draw") updateDrawCursor(e.evt.altKey);
            else if (tool === "calibrate" && calib.points.length === 1) {
              const p = worldPointer();
              if (p) setCalib((c) => ({ ...c, cursor: p }));
            }
          }}
          onClick={(e) => e.evt.button === 0 && onStagePointer(e)}
          onTap={onStagePointer}
          onTouchMove={(e) => {
            const touches = e.evt.touches;
            if (touches.length === 2) {
              e.evt.preventDefault();
              const stage = stageRef.current;
              if (!stage) return;
              if (stage.isDragging()) stage.stopDrag();
              const rect = stage.container().getBoundingClientRect();
              const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
              const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
              const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
              const dist = distance(p1, p2);
              if (pinch.current) {
                const v = useView2D.getState();
                v.zoomAt(center, dist / pinch.current.dist);
                const after = useView2D.getState();
                after.setView({
                  x: after.x + center.x - pinch.current.center.x,
                  y: after.y + center.y - pinch.current.center.y,
                });
              }
              pinch.current = { dist, center };
            } else if (tool === "draw") updateDrawCursor(false);
          }}
          onTouchEnd={() => {
            pinch.current = null;
          }}
        >
          <GridLayer grid={grid} />
          <BackgroundLayer bg={background} />
          <Layer listening={false}>
            <PlanGhosts house={house} floor={floor} />
          </Layer>
          <Layer>
            <PlanRooms
              rooms={floor.rooms}
              dimmedRoomIds={dimmed}
              draggable={roomsDraggable}
              drag={roomDrag}
              listening={interactiveRooms}
            />
            <PlanItems
              rooms={floor.rooms}
              dimmedRoomIds={dimmed}
              interactive={interactiveRooms}
              focusedRoomId={mode === "room" ? focusedRoomId : null}
            />
            <PlanWalls
              walls={walls}
              rooms={floor.rooms}
              openings={openings}
              interactiveRoomId={mode === "room" ? focusedRoomId : null}
              dimmedRoomIds={dimmed}
              listening={interactiveRooms}
            />
            <PlanRoomLabels rooms={floor.rooms} dimmedRoomIds={dimmed} />
            {mode === "house" && selectedRoom && <RoomSelectionOutline room={selectedRoom} />}
            <SnapHighlights matches={snapMatches} walls={walls} />
            {view.showDimensions && mode === "room" && focusedRoom && <RoomDimensions room={focusedRoom} walls={walls} />}
            {view.showDimensions && mode === "house" && selectedRoom && <RoomDimensions room={selectedRoom} walls={walls} />}
            {selectedOpening && (
              <OpeningDimensions room={selectedOpening.room} opening={selectedOpening.opening} walls={walls} />
            )}
            {mode === "room" && focusedRoom && !readOnly && <PlanHandles room={focusedRoom} grid={grid} />}
            {tool === "draw" && <DrawOverlay state={draw} />}
            {tool === "calibrate" && <CalibrationShapes points={calib.points} cursor={calib.cursor} />}
          </Layer>
        </Stage>
      )}
      {TOOL_HINTS[tool] && (
        <div className="pointer-events-none absolute left-3 top-3 max-w-md rounded-[5px] border border-line bg-panel/95 px-3 py-2 text-[13px] leading-snug text-graphite-soft">
          {TOOL_HINTS[tool]}
        </div>
      )}
      {tool === "calibrate" && <CalibrationPanel points={calib.points} onReset={() => setCalib({ points: [], cursor: null })} />}
      {floor.rooms.length === 0 && !background && tool !== "draw" && tool !== "calibrate" && (
        <EmptyFloorHint />
      )}
      <ZoomControls />
    </div>
  );
}

function EmptyFloorHint() {
  const setTool = useEditor((s) => s.setTool);
  const openDialog = useEditor((s) => s.openDialog);
  const readOnly = useEditor((s) => s.readOnly);
  const below = useEditor((s) => adjacentFloor(s.house, s.activeFloorId, -1));
  if (readOnly) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-[8px] border border-line-strong bg-panel p-5 text-center shadow-[0_10px_30px_-18px_rgba(35,39,43,0.4)]">
        <p className="text-[15px] font-semibold">Questo piano è ancora vuoto</p>
        <p className="mt-1 text-sm text-muted">Disegna i muri di una stanza o parti da un rettangolo con le misure che conosci.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            className="h-9 rounded-[5px] border border-prussian bg-prussian px-3 text-sm font-medium text-white hover:bg-prussian-strong"
            onClick={() => openDialog("rect")}
          >
            Stanza rettangolare
          </button>
          <button
            type="button"
            className="h-9 rounded-[5px] border border-line-strong bg-panel px-3 text-sm font-medium hover:border-graphite-soft"
            onClick={() => setTool("draw")}
          >
            Disegna i muri
          </button>
        </div>
        <button type="button" className="mt-3 text-sm font-medium text-prussian underline" onClick={() => openDialog("import")}>
          Carica una planimetria
        </button>
        {below && below.rooms.length > 0 && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-prussian underline"
            onClick={() => {
              copyRoomsFromBelow();
              requestAnimationFrame(() => fitToFloor());
            }}
          >
            Copia le stanze di {below.name.toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

/** Evidenzia i lati agganciati durante il trascinamento di una stanza. */
function SnapHighlights({ matches, walls }: { matches: EdgeMatch[]; walls: FloorWalls }) {
  if (!matches.length) return null;
  const edge = (roomId: string, wallId: string) => walls.edgesByRoom.get(roomId)?.find((e) => e.wallId === wallId);
  return (
    <>
      {matches.flatMap((m, i) =>
        [m.moving, m.target].map((ref, j) => {
          const e = edge(ref.roomId, ref.wallId);
          if (!e) return null;
          return (
            <Line
              key={`${i}-${j}`}
              points={[e.a.x, e.a.y, e.b.x, e.b.y]}
              stroke={m.kind === "facing" ? "#1d4f91" : "#c2410c"}
              strokeWidth={4}
              dash={m.kind === "facing" ? undefined : [8, 6]}
              strokeScaleEnabled={false}
              listening={false}
            />
          );
        }),
      )}
    </>
  );
}
