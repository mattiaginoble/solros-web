"use client";
/**
 * Vista 3D della casa: orbita, camminata in prima persona e vista dall'alto.
 * I soffitti e i piani superiori si possono nascondere.
 */
import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Segmented } from "@/components/ui/controls";
import { IconOrbit, IconTop, IconWalk } from "@/components/ui/icons";
import { bbox, bboxUnion, centroid, pointInPolygon, type BBox } from "@/lib/geometry/polygon";
import { localToWorld, roomWorldPolygon } from "@/lib/geometry/transform";
import { computeFloorWalls, pieceQuad, pieceSegments } from "@/lib/geometry/walls";
import { activeFloor, findRoom, useEditor } from "@/store/editor";
import { useView3D, type CameraMode } from "@/store/view3d";
import { CM } from "./geometry";
import { HouseScene } from "./HouseScene";
import type { Floor, House } from "@/domain/schema";
import type { Vec2 } from "@/lib/geometry/vec";

function floorsBBox(floors: Floor[]): BBox | null {
  const boxes = floors.flatMap((f) => f.rooms.map((r) => bbox(roomWorldPolygon(r))));
  return boxes.length ? boxes.reduce(bboxUnion) : null;
}

/** Muri pieni (e finestre) che bloccano la camminata, come quadrilateri in pianta. */
function blockingQuads(floor: Floor): Vec2[][] {
  const walls = computeFloorWalls(floor.rooms);
  const out: Vec2[][] = [];
  for (const p of walls.pieces)
    for (const seg of pieceSegments(p)) {
      const o = seg.opening?.opening;
      if (o && o.kind !== "window" && o.sill < 20) continue;
      out.push(pieceQuad(p, seg.s0, seg.s1));
    }
  return out;
}

const keys = new Set<string>();

function WalkControls({ start, floor, eyeHeight, touchMove }: { start: Vec2; floor: Floor; eyeHeight: number; touchMove: React.RefObject<{ f: number; r: number }> }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const quads = useMemo(() => blockingQuads(floor), [floor]);

  useEffect(() => {
    camera.position.set(start.x * CM, (floor.elevation + eyeHeight) * CM, start.y * CM);
    yaw.current = 0;
    pitch.current = 0;
  }, [camera, start.x, start.y, floor.elevation, eyeHeight]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let last = { x: 0, y: 0 };
    const down = (e: PointerEvent) => {
      dragging = true;
      last = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.current -= (e.clientX - last.x) * 0.004;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => (dragging = false);
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
      keys.add(e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      keys.clear();
    };
  }, [gl]);

  useFrame((_, dt) => {
    const speed = (keys.has("shift") ? 3 : 1.4) * dt;
    let f = touchMove.current.f;
    let r = touchMove.current.r;
    if (keys.has("w") || keys.has("arrowup")) f += 1;
    if (keys.has("s") || keys.has("arrowdown")) f -= 1;
    if (keys.has("a") || keys.has("arrowleft")) r -= 1;
    if (keys.has("d") || keys.has("arrowright")) r += 1;
    const fwd = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const step = fwd.multiplyScalar(f * speed).add(right.multiplyScalar(r * speed));
    if (step.lengthSq() > 0) {
      const next = camera.position.clone().add(step);
      const probe = { x: (next.x + Math.sign(step.x) * 0.15) / CM, y: (next.z + Math.sign(step.z) * 0.15) / CM };
      const blocked = quads.some((q) => pointInPolygon(probe, q) || pointInPolygon({ x: next.x / CM, y: next.z / CM }, q));
      if (!blocked) camera.position.copy(next);
    }
    camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
  });
  return null;
}

function ShadowLight({ box, elevation }: { box: BBox; elevation: number }) {
  const cx = ((box.minX + box.maxX) / 2) * CM;
  const cz = ((box.minY + box.maxY) / 2) * CM;
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY) * CM + 4;
  const ref = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.target.position.set(cx, elevation * CM, cz);
    ref.current.target.updateMatrixWorld();
  }, [cx, cz, elevation]);
  return (
    <directionalLight
      ref={ref}
      position={[cx + size * 0.4, elevation * CM + size * 0.9, cz + size * 0.6]}
      intensity={1.5}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-size}
      shadow-camera-right={size}
      shadow-camera-top={size}
      shadow-camera-bottom={-size}
      shadow-camera-near={0.5}
      shadow-camera-far={size * 4}
      shadow-bias={-0.0004}
    />
  );
}

function Scene({ house, touchMove }: { house: House; touchMove: React.RefObject<{ f: number; r: number }> }) {
  const { mode, showCeilings, hideUpperFloors } = useView3D();
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const selection = useEditor((s) => s.selection);
  const focusedRoomId = useEditor((s) => s.focusedRoomId);
  const select = useEditor((s) => s.select);
  const active = activeFloor({ house, activeFloorId });
  const floors = useMemo(
    () => (hideUpperFloors ? house.floors.filter((f) => f.level <= active.level) : house.floors),
    [house.floors, hideUpperFloors, active.level],
  );
  const box = floorsBBox([active]) ?? floorsBBox(house.floors) ?? { minX: 0, minY: 0, maxX: 500, maxY: 500 };
  const cx = ((box.minX + box.maxX) / 2) * CM;
  const cz = ((box.minY + box.maxY) / 2) * CM;
  const size = Math.max(box.maxX - box.minX, box.maxY - box.minY, 300) * CM;
  const elev = active.elevation * CM;
  const viewport = useThree((st) => st.size);
  const topZoom = (Math.min(viewport.width, viewport.height) * 0.85) / (size + 0.8);

  const walkStart = useMemo(() => {
    const roomId = focusedRoomId ?? selection?.roomId;
    const loc = roomId ? findRoom(house, roomId) : null;
    const room = loc && loc.floor.id === active.id ? loc.room : active.rooms[0];
    if (!room) return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    return localToWorld(room, centroid(room.polygon));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, mode]);

  return (
    <>
      <color attach="background" args={["#e8eeeb"]} />
      <hemisphereLight args={["#ffffff", "#b8b2a6", 0.75]} />
      <ambientLight intensity={0.25} />
      <ShadowLight box={box} elevation={active.elevation} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02 + Math.min(0, elev), cz]} receiveShadow>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color="#dfe6e1" roughness={1} />
      </mesh>
      <HouseScene
        house={house}
        floors={floors}
        showCeilings={showCeilings}
        selectedItemId={selection?.kind === "item" ? selection.itemId : null}
        onSelectItem={(roomId, itemId) => select({ kind: "item", roomId, itemId })}
        onSelectRoom={(roomId) => select({ kind: "room", roomId })}
      />
      {mode === "orbit" && (
        <>
          <PerspectiveCamera makeDefault fov={45} near={0.05} far={500} position={[cx + size * 0.55, elev + size * 1.35, cz + size * 1.0]} />
          <OrbitControls makeDefault target={[cx, elev + 0.6, cz]} maxPolarAngle={Math.PI / 2 - 0.03} minDistance={1} maxDistance={size * 6} enableDamping />
        </>
      )}
      {mode === "top" && (
        <>
          <OrthographicCamera makeDefault position={[cx, elev + 40, cz]} zoom={topZoom} near={0.1} far={200} up={[0, 0, -1]} />
          <MapControls makeDefault target={[cx, elev, cz]} enableRotate={false} screenSpacePanning />
        </>
      )}
      {mode === "walk" && (
        <>
          <PerspectiveCamera makeDefault fov={70} near={0.05} far={300} />
          <WalkControls start={walkStart} floor={active} eyeHeight={165} touchMove={touchMove} />
        </>
      )}
    </>
  );
}

function HoldButton({ label, onHold, children }: { label: string; onHold: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-11 w-11 select-none items-center justify-center rounded-[6px] border border-line-strong bg-panel/95 text-lg active:bg-prussian-tint"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
    >
      {children}
    </button>
  );
}

export default function Viewer3D() {
  const house = useEditor((s) => s.house);
  const { mode, setMode, showCeilings, toggleCeilings, hideUpperFloors, toggleUpperFloors } = useView3D();
  const touchMove = useRef({ f: 0, r: 0 });
  const [hint, setHint] = useState(true);
  const hasUpper = house.floors.length > 1;

  return (
    <div className="relative h-full w-full">
      <Canvas shadows="percentage" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <Scene house={house} touchMove={touchMove} />
      </Canvas>
      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <Segmented<CameraMode>
          label="Modalità di visione"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setHint(true);
          }}
          options={[
            { value: "orbit", label: "Orbita", icon: <IconOrbit size={16} /> },
            { value: "walk", label: "Camminata", icon: <IconWalk size={16} /> },
            { value: "top", label: "Dall’alto", icon: <IconTop size={16} /> },
          ]}
        />
        <label className="flex h-9 items-center gap-2 rounded-[6px] border border-line-strong bg-panel/95 px-2.5 text-[13px]">
          <input type="checkbox" checked={showCeilings} onChange={toggleCeilings} />
          Soffitti
        </label>
        {hasUpper && (
          <label className="flex h-9 items-center gap-2 rounded-[6px] border border-line-strong bg-panel/95 px-2.5 text-[13px]">
            <input type="checkbox" checked={hideUpperFloors} onChange={toggleUpperFloors} />
            Nascondi piani superiori
          </label>
        )}
      </div>
      {hint && (
        <button
          type="button"
          onClick={() => setHint(false)}
          className="absolute bottom-3 left-3 max-w-sm rounded-[5px] border border-line bg-panel/95 px-3 py-2 text-left text-[12.5px] text-graphite-soft"
        >
          {mode === "walk"
            ? "Trascina per guardarti intorno, muoviti con W A S D o con le frecce (Maiusc per correre). I muri non si attraversano, le porte sì."
            : mode === "top"
              ? "Trascina per spostarti, rotella o pizzico per lo zoom."
              : "Trascina per ruotare, tasto destro per spostare, rotella per lo zoom. Clic su un oggetto per selezionarlo."}
        </button>
      )}
      {mode === "walk" && (
        <div className="absolute bottom-3 right-3 grid grid-cols-3 gap-1" aria-label="Movimento">
          <span />
          <HoldButton label="Avanti" onHold={(on) => (touchMove.current.f = on ? 1 : 0)}>↑</HoldButton>
          <span />
          <HoldButton label="Sinistra" onHold={(on) => (touchMove.current.r = on ? -1 : 0)}>←</HoldButton>
          <HoldButton label="Indietro" onHold={(on) => (touchMove.current.f = on ? -1 : 0)}>↓</HoldButton>
          <HoldButton label="Destra" onHold={(on) => (touchMove.current.r = on ? 1 : 0)}>→</HoldButton>
        </div>
      )}
    </div>
  );
}
