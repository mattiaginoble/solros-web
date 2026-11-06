"use client";
import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { FLOOR_MATERIAL_BY_ID, WALL_MATERIAL_BY_ID } from "@/domain/materials";
import type { Floor, House, PlacedItem, Room } from "@/domain/schema";
import { roomWorldPolygon } from "@/lib/geometry/transform";
import {
  type OpeningGeometry,
  type WallPiece,
  computeFloorWalls,
  openingGeometries,
  pieceQuad,
  pieceSegments,
} from "@/lib/geometry/walls";
import { CM, polygonSurface, prismGeometry } from "./geometry";
import { ItemModel } from "./ItemModel";
import { materialTexture } from "./textures";

const EXTERIOR = "#ece9e3";
const CUT = "#5b6066";

function useWallMaterial(color: string, matId: string) {
  return useMemo(() => {
    const def = WALL_MATERIAL_BY_ID[matId];
    const map = def ? materialTexture(def, color) : null;
    return new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : color, map, roughness: 0.92, side: THREE.DoubleSide });
  }, [color, matId]);
}

const exteriorMaterial = new THREE.MeshStandardMaterial({ color: EXTERIOR, roughness: 0.95, side: THREE.DoubleSide });
const cutMaterial = new THREE.MeshStandardMaterial({ color: CUT, roughness: 0.9, side: THREE.DoubleSide });
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: "#cfe5ee",
  transparent: true,
  opacity: 0.28,
  roughness: 0.05,
  metalness: 0.1,
  side: THREE.DoubleSide,
});
const frameMaterial = new THREE.MeshStandardMaterial({ color: "#f3f3f1", roughness: 0.6 });
const doorMaterial = new THREE.MeshStandardMaterial({ color: "#e9e3d8", roughness: 0.7 });

export interface HouseSceneProps {
  house: House;
  floors: Floor[];
  showCeilings: boolean;
  selectedItemId: string | null;
  onSelectItem?: (roomId: string, itemId: string) => void;
  onSelectRoom?: (roomId: string) => void;
}

export function HouseScene({ house, floors, showCeilings, selectedItemId, onSelectItem, onSelectRoom }: HouseSceneProps) {
  return (
    <group>
      {floors.map((f) => (
        <FloorGroup
          key={f.id}
          house={house}
          floor={f}
          showCeilings={showCeilings}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onSelectRoom={onSelectRoom}
        />
      ))}
    </group>
  );
}

function FloorGroup({
  floor,
  showCeilings,
  selectedItemId,
  onSelectItem,
  onSelectRoom,
}: { floor: Floor } & Omit<HouseSceneProps, "floors"> & { house: House }) {
  const walls = useMemo(() => computeFloorWalls(floor.rooms), [floor.rooms]);
  const openings = useMemo(() => openingGeometries(floor.rooms, walls), [floor.rooms, walls]);
  const roomsById = useMemo(() => new Map(floor.rooms.map((r) => [r.id, r])), [floor.rooms]);
  return (
    <group position={[0, floor.elevation * CM, 0]}>
      {floor.rooms.map((r) => (
        <RoomSurfaces key={r.id} room={r} showCeiling={showCeilings} onSelect={onSelectRoom} />
      ))}
      {walls.pieces.map((p) => (
        <WallPieceMesh key={p.key} piece={p} room={roomsById.get(p.roomId)!} other={p.shared ? roomsById.get(p.shared.roomId) : undefined} />
      ))}
      {openings.map((o) => (
        <OpeningMesh key={o.opening.id} geom={o} />
      ))}
      {floor.rooms.map((r) => (
        <group key={r.id} position={[r.x * CM, 0, r.y * CM]} rotation={[0, (-r.rotation * Math.PI) / 180, 0]}>
          {r.items.map((it) => (
            <ItemNode3D key={it.id} room={r} item={it} selected={it.id === selectedItemId} onSelect={onSelectItem} />
          ))}
        </group>
      ))}
    </group>
  );
}

function RoomSurfaces({ room, showCeiling, onSelect }: { room: Room; showCeiling: boolean; onSelect?: (id: string) => void }) {
  const poly = useMemo(() => roomWorldPolygon(room), [room]);
  const floorGeo = useMemo(() => polygonSurface(poly, 0.2, true), [poly]);
  const ceilGeo = useMemo(() => polygonSurface(poly, room.ceilingHeight, false), [poly, room.ceilingHeight]);
  const floorMat = useMemo(() => {
    const def = FLOOR_MATERIAL_BY_ID[room.floorMaterial.id];
    const map = def ? materialTexture(def, room.floorMaterial.color) : null;
    return new THREE.MeshStandardMaterial({ color: map ? "#ffffff" : room.floorMaterial.color, map, roughness: 0.8 });
  }, [room.floorMaterial.id, room.floorMaterial.color]);
  return (
    <>
      <mesh
        geometry={floorGeo}
        material={floorMat}
        receiveShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect?.(room.id);
        }}
      />
      {showCeiling && (
        <mesh geometry={ceilGeo}>
          <meshStandardMaterial color="#fbfbf9" roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      )}
    </>
  );
}

function WallPieceMesh({ piece, room, other }: { piece: WallPiece; room: Room; other?: Room }) {
  const inner = useWallMaterial(room.wallMaterial.color, room.wallMaterial.id);
  const outer = useWallMaterial(other?.wallMaterial.color ?? EXTERIOR, other?.wallMaterial.id ?? "pittura-bianca");
  const materials = useMemo(() => [inner, other ? outer : exteriorMaterial, cutMaterial], [inner, outer, other]);
  const height = Math.max(room.ceilingHeight, other?.ceilingHeight ?? 0);
  const geometries = useMemo(() => {
    const out: THREE.BufferGeometry[] = [];
    for (const seg of pieceSegments(piece)) {
      const quad = pieceQuad(piece, seg.s0, seg.s1);
      if (!seg.opening) {
        out.push(prismGeometry(quad, 0, height, 0, 2));
      } else {
        const o = seg.opening.opening;
        if (o.sill > 0.5) out.push(prismGeometry(quad, 0, o.sill, 0, 2));
        const top = o.sill + o.height;
        if (top < height - 0.5) out.push(prismGeometry(quad, top, height, 0, 2));
      }
    }
    return out;
  }, [piece, height]);
  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={materials} castShadow receiveShadow />
      ))}
    </>
  );
}

function OpeningMesh({ geom }: { geom: OpeningGeometry }) {
  const { opening: o, start, end, inward, thickness } = geom;
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const angle = -Math.atan2(dz, dx);
  const mid = { x: (start.x + end.x) / 2 - (inward.x * thickness) / 2, y: (start.y + end.y) / 2 - (inward.y * thickness) / 2 };
  const w = o.width * CM;
  const t = thickness * CM;
  if (o.kind === "window") {
    const h = o.height * CM;
    const y = (o.sill + o.height / 2) * CM;
    const f = 0.05;
    return (
      <group position={[mid.x * CM, y, mid.y * CM]} rotation={[0, angle, 0]}>
        <mesh material={glassMaterial}>
          <boxGeometry args={[w - f * 2, h - f * 2, 0.01]} />
        </mesh>
        <mesh material={frameMaterial} position={[0, h / 2 - f / 2, 0]}>
          <boxGeometry args={[w, f, t * 0.5]} />
        </mesh>
        <mesh material={frameMaterial} position={[0, -h / 2 + f / 2, 0]}>
          <boxGeometry args={[w, f, t * 0.9]} />
        </mesh>
        <mesh material={frameMaterial} position={[-w / 2 + f / 2, 0, 0]}>
          <boxGeometry args={[f, h, t * 0.5]} />
        </mesh>
        <mesh material={frameMaterial} position={[w / 2 - f / 2, 0, 0]}>
          <boxGeometry args={[f, h, t * 0.5]} />
        </mesh>
        {w > 1 && (
          <mesh material={frameMaterial}>
            <boxGeometry args={[f * 0.7, h, t * 0.4]} />
          </mesh>
        )}
      </group>
    );
  }
  if (o.kind === "door") {
    // Nel gruppo locale x segue il muro (inizio → fine) e +z punta verso l'interno della stanza.
    // L'anta parte dalla cerniera verso l'altro stipite ed è aperta di 70° dal lato del verso di apertura.
    const h = o.height * CM;
    const hingeAtStart = o.hinge === "start";
    const swingSign = o.swing === "in" ? 1 : -1;
    const face = o.swing === "in" ? 0 : thickness;
    const base = hingeAtStart ? start : end;
    const hinge = { x: base.x - inward.x * face, y: base.y - inward.y * face };
    const leafDir = hingeAtStart ? 1 : -1;
    const rot = -swingSign * leafDir * ((70 * Math.PI) / 180);
    return (
      <group position={[hinge.x * CM, 0, hinge.y * CM]} rotation={[0, angle, 0]}>
        <group rotation={[0, rot, 0]}>
          <mesh material={doorMaterial} position={[(leafDir * (w - 0.02)) / 2, h / 2, 0]} castShadow>
            <boxGeometry args={[w - 0.02, h - 0.01, 0.04]} />
          </mesh>
        </group>
      </group>
    );
  }
  return null;
}

function ItemNode3D({
  room,
  item,
  selected,
  onSelect,
}: {
  room: Room;
  item: PlacedItem;
  selected: boolean;
  onSelect?: (roomId: string, itemId: string) => void;
}) {
  const p = item.product;
  const y = p.mount === "ceiling" ? room.ceilingHeight - p.height : item.elevation;
  return (
    <group
      position={[item.x * CM, y * CM, item.y * CM]}
      rotation={[0, (-item.rotation * Math.PI) / 180, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect?.(room.id, item.id);
      }}
    >
      <ItemModel product={p} />
      {selected && (
        <lineSegments position={[0, (p.height * CM) / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(p.width * CM + 0.02, p.height * CM + 0.02, p.depth * CM + 0.02)]} />
          <lineBasicMaterial color="#1d4f91" />
        </lineSegments>
      )}
    </group>
  );
}
