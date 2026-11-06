"use client";
import { useMemo, type ReactNode } from "react";
import { Button, NumberField, SelectField, TextField, formatNumber } from "@/components/ui/controls";
import { IconCopy, IconRotate, IconTrash } from "@/components/ui/icons";
import { OPENING_DEFAULTS, ROOM_COLOR_SWATCHES, ROOM_TYPES, ROOM_TYPE_COLOR, ROOM_TYPE_LABEL } from "@/domain/constants";
import { FLOOR_MATERIALS, FLOOR_MATERIAL_BY_ID, WALL_MATERIALS, WALL_MATERIAL_BY_ID } from "@/domain/materials";
import type { Opening, OpeningKind, Room, RoomType } from "@/domain/schema";
import {
  addOpening,
  roomStats,
  setEdgeLength,
  setVertex,
  setWallThickness,
  updateOpening,
} from "@/domain/roomOps";
import { edgeLength } from "@/lib/geometry/polygon";
import { rotateRoomTransform } from "@/lib/geometry/transform";
import { computeFloorWalls, listSharedWalls } from "@/lib/geometry/walls";
import { deleteSelection, duplicateSelection, fitToRoom, rotateSelection } from "@/store/actions";
import { activeFloor, findRoom, useEditor } from "@/store/editor";

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-graphite">{title}</h3>
        {aside}
      </div>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

function ReadValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex h-9 items-center text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

export function PropertiesPanel() {
  const selection = useEditor((s) => s.selection);
  const house = useEditor((s) => s.house);
  const readOnly = useEditor((s) => s.readOnly);
  const loc = selection ? findRoom(house, selection.roomId) : null;

  let body: ReactNode;
  if (!selection || !loc) body = <FloorSummary />;
  else if (selection.kind === "room") body = <RoomProps room={loc.room} />;
  else if (selection.kind === "wall") body = <WallProps room={loc.room} wallId={selection.wallId} />;
  else if (selection.kind === "opening") {
    const o = loc.room.openings.find((x) => x.id === selection.openingId);
    body = o ? <OpeningProps room={loc.room} opening={o} /> : null;
  } else if (selection.kind === "vertex") body = <VertexProps room={loc.room} index={selection.index} />;
  else body = null;

  return (
    <div
      className={`max-h-[34vh] min-h-[92px] overflow-y-auto border-t border-line bg-panel px-4 py-3 ${readOnly ? "pointer-events-none opacity-80" : ""}`}
      aria-label="Proprietà"
    >
      {body}
    </div>
  );
}

function FloorSummary() {
  const s = useEditor();
  const floor = activeFloor(s);
  const totalArea = floor.rooms.reduce((a, r) => a + roomStats(r).areaM2, 0);
  const apply = s.apply;
  return (
    <div className="flex flex-wrap items-start gap-8">
      <Section title={floor.name}>
        <ReadValue label="Stanze" value={String(floor.rooms.length)} />
        <ReadValue label="Superficie netta" value={`${formatNumber(totalArea, 1)} m²`} />
      </Section>
      <Section title="Impostazioni del progetto">
        <NumberField
          label="Passo griglia"
          value={s.house.settings.gridSize}
          min={1}
          max={100}
          onChange={(v) => apply((h) => void (h.settings.gridSize = v))}
          width="w-16"
        />
        <NumberField
          label="Spessore muri nuove stanze"
          value={s.house.settings.defaultWallThickness}
          min={1}
          max={80}
          onChange={(v) => apply((h) => void (h.settings.defaultWallThickness = v))}
          width="w-16"
        />
        <NumberField
          label="Altezza soffitto predefinita"
          value={s.house.settings.defaultCeilingHeight}
          min={150}
          max={600}
          onChange={(v) => apply((h) => void (h.settings.defaultCeilingHeight = v))}
          width="w-16"
        />
      </Section>
      <p className="max-w-xs self-center text-sm text-muted">
        Seleziona una stanza, un muro o un’apertura per modificarne le misure. Doppio clic su una stanza per
        modificarne la forma.
      </p>
    </div>
  );
}

function RoomProps({ room }: { room: Room }) {
  const updateRoom = useEditor((s) => s.updateRoom);
  const mode = useEditor((s) => s.mode);
  const focusRoom = useEditor((s) => s.focusRoom);
  const stats = roomStats(room);
  const up = (fn: (r: Room) => Room) => updateRoom(room.id, fn);
  const thicknesses = new Set(room.walls.map((w) => w.thickness));

  const changeType = (type: RoomType) =>
    up((r) => ({
      ...r,
      type,
      color: r.color === ROOM_TYPE_COLOR[r.type] ? ROOM_TYPE_COLOR[type] : r.color,
      name: r.name === ROOM_TYPE_LABEL[r.type] ? ROOM_TYPE_LABEL[type] : r.name,
    }));

  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <Section title="Stanza">
        <TextField label="Nome" value={room.name} onChange={(name) => up((r) => ({ ...r, name }))} className="w-40" />
        <SelectField
          label="Tipo"
          value={room.type}
          options={ROOM_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={changeType}
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Colore</span>
          <div className="flex h-9 items-center gap-1">
            {ROOM_COLOR_SWATCHES.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colore ${c}`}
                onClick={() => up((r) => ({ ...r, color: c }))}
                className={`h-6 w-6 rounded-[4px] border ${room.color === c ? "border-prussian ring-2 ring-prussian/30" : "border-line-strong"}`}
                style={{ background: c }}
              />
            ))}
            <input
              type="color"
              aria-label="Colore personalizzato"
              value={room.color}
              onChange={(e) => up((r) => ({ ...r, color: e.target.value }))}
              className="h-7 w-8 cursor-pointer rounded border border-line-strong bg-panel"
            />
          </div>
        </div>
        <ReadValue label="Superficie" value={`${formatNumber(stats.areaM2, 2)} m²`} />
        <ReadValue label="Perimetro" value={`${formatNumber(stats.perimeter / 100, 2)} m`} />
      </Section>

      <Section title="Muri e soffitto">
        <NumberField
          label={thicknesses.size > 1 ? "Spessore muri (diversi)" : "Spessore muri"}
          value={room.walls[0]?.thickness ?? 10}
          min={1}
          max={80}
          onChange={(v) => up((r) => setWallThickness(r, "all", v))}
          width="w-16"
        />
        <NumberField
          label="Altezza soffitto"
          value={room.ceilingHeight}
          min={150}
          max={800}
          onChange={(v) => up((r) => ({ ...r, ceilingHeight: v }))}
          width="w-16"
        />
        <NumberField
          label="Rotazione"
          unit="°"
          value={room.rotation}
          min={-360}
          max={360}
          onChange={(v) => up((r) => ({ ...r, ...rotateRoomTransform(r, v - r.rotation) }))}
          width="w-14"
        />
        <SelectField
          label="Pavimento"
          value={room.floorMaterial.id}
          options={FLOOR_MATERIALS.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(id) => up((r) => ({ ...r, floorMaterial: { id, color: FLOOR_MATERIAL_BY_ID[id].color } }))}
        />
        <SelectField
          label="Pareti"
          value={room.wallMaterial.id}
          options={WALL_MATERIALS.map((m) => ({ value: m.id, label: m.label }))}
          onChange={(id) => up((r) => ({ ...r, wallMaterial: { id, color: WALL_MATERIAL_BY_ID[id].color } }))}
        />
      </Section>

      <Section title="Lati (misure interne)">
        {stats.edgeLengths.map((len, i) => (
          <NumberField
            key={room.walls[i]?.id ?? i}
            label={`Lato ${i + 1}`}
            value={len}
            min={10}
            max={5000}
            onChange={(v) => up((r) => setEdgeLength(r, i, v))}
            width="w-16"
          />
        ))}
      </Section>

      <Section title="Azioni">
        {mode === "house" ? (
          <Button
            variant="primary"
            onClick={() => {
              focusRoom(room.id);
              fitToRoom(room.id);
            }}
          >
            Modifica forma e aperture
          </Button>
        ) : (
          <Button onClick={() => focusRoom(null)}>Torna alla casa</Button>
        )}
        <Button icon={<IconRotate size={16} />} onClick={() => rotateSelection(90)} title="Ruota di 90° (R)">
          Ruota
        </Button>
        <Button icon={<IconCopy size={16} />} onClick={duplicateSelection} title="Duplica (Ctrl+D)">
          Duplica
        </Button>
        <Button variant="danger" icon={<IconTrash size={16} />} onClick={deleteSelection} title="Elimina (Canc)">
          Elimina
        </Button>
      </Section>
    </div>
  );
}

function WallProps({ room, wallId }: { room: Room; wallId: string }) {
  const updateRoom = useEditor((s) => s.updateRoom);
  const select = useEditor((s) => s.select);
  const house = useEditor((s) => s.house);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const idx = room.walls.findIndex((w) => w.id === wallId);
  const wall = room.walls[idx];
  const floor = activeFloor({ house, activeFloorId });
  const shared = useMemo(() => {
    const walls = computeFloorWalls(floor.rooms);
    return listSharedWalls(walls).filter(
      (s) => (s.roomId === room.id && s.wallId === wallId) || (s.otherRoomId === room.id && s.otherWallId === wallId),
    );
  }, [floor.rooms, room.id, wallId]);
  if (!wall) return null;
  const len = edgeLength(room.polygon, idx);
  const openings = room.openings.filter((o) => o.wallId === wallId);

  const add = (kind: OpeningKind) => {
    const res = addOpening(room, kind, wallId, len / 2);
    if (!res.opening) {
      useEditor.getState().notify("Il muro è troppo corto per questa apertura", "warning");
      return;
    }
    updateRoom(room.id, () => res.room);
    select({ kind: "opening", roomId: room.id, openingId: res.opening.id });
  };

  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <Section title={`Muro ${idx + 1} di ${room.name}`}>
        <NumberField
          label="Lunghezza interna"
          value={len}
          min={10}
          max={5000}
          onChange={(v) => updateRoom(room.id, (r) => setEdgeLength(r, idx, v))}
          width="w-16"
        />
        <NumberField
          label="Spessore"
          value={wall.thickness}
          min={1}
          max={80}
          onChange={(v) => updateRoom(room.id, (r) => setWallThickness(r, wallId, v))}
          width="w-16"
          hint={shared.length ? `Condiviso: spessore reale ${formatNumber(shared[0].gap, 1)} cm` : undefined}
        />
        {shared.length > 0 && (
          <ReadValue
            label="Muro condiviso con"
            value={shared
              .map((s) => {
                const otherId = s.roomId === room.id ? s.otherRoomId : s.roomId;
                return floor.rooms.find((r) => r.id === otherId)?.name ?? "stanza";
              })
              .join(", ")}
          />
        )}
      </Section>
      <Section title="Aperture su questo muro">
        {(["door", "window", "passage"] as OpeningKind[]).map((k) => (
          <Button key={k} size="sm" onClick={() => add(k)}>
            Aggiungi {OPENING_DEFAULTS[k].label.toLowerCase()}
          </Button>
        ))}
        {openings.map((o) => (
          <Button key={o.id} size="sm" variant="ghost" onClick={() => select({ kind: "opening", roomId: room.id, openingId: o.id })}>
            {OPENING_DEFAULTS[o.kind].label} {formatNumber(o.width, 0)} cm
          </Button>
        ))}
      </Section>
    </div>
  );
}

function OpeningProps({ room, opening }: { room: Room; opening: Opening }) {
  const updateRoom = useEditor((s) => s.updateRoom);
  const idx = room.walls.findIndex((w) => w.id === opening.wallId);
  const len = edgeLength(room.polygon, idx);
  const up = (patch: Partial<Opening>) => updateRoom(room.id, (r) => updateOpening(r, opening.id, patch));
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <Section title={`${OPENING_DEFAULTS[opening.kind].label} su muro ${idx + 1} di ${room.name}`}>
        <SelectField
          label="Tipo"
          value={opening.kind}
          options={(["door", "window", "passage"] as OpeningKind[]).map((k) => ({ value: k, label: OPENING_DEFAULTS[k].label }))}
          onChange={(kind) =>
            up({
              kind,
              sill: OPENING_DEFAULTS[kind].sill,
              height: OPENING_DEFAULTS[kind].height,
            })
          }
        />
        <NumberField label="Larghezza" value={opening.width} min={20} max={len} onChange={(v) => up({ width: v })} width="w-16" />
        <NumberField label="Altezza" value={opening.height} min={20} max={room.ceilingHeight - opening.sill} onChange={(v) => up({ height: v })} width="w-16" />
        <NumberField
          label="Altezza da terra"
          value={opening.sill}
          min={0}
          max={room.ceilingHeight - 20}
          onChange={(v) => up({ sill: v })}
          width="w-16"
        />
        <NumberField
          label="Distanza dall’angolo"
          value={opening.offset}
          min={0}
          max={Math.max(0, len - opening.width)}
          onChange={(v) => up({ offset: v })}
          width="w-16"
          hint={`Dall’altro angolo: ${formatNumber(len - opening.offset - opening.width, 1)} cm`}
        />
      </Section>
      {opening.kind === "door" && (
        <Section title="Anta">
          <SelectField
            label="Cerniera (vista dall’interno)"
            value={opening.hinge}
            options={[
              { value: "start", label: "A sinistra" },
              { value: "end", label: "A destra" },
            ]}
            onChange={(hinge) => up({ hinge })}
          />
          <SelectField
            label="Apertura"
            value={opening.swing}
            options={[
              { value: "in", label: "Verso l’interno" },
              { value: "out", label: "Verso l’esterno" },
            ]}
            onChange={(swing) => up({ swing })}
          />
        </Section>
      )}
      <Section title="Azioni">
        <Button icon={<IconCopy size={16} />} onClick={duplicateSelection}>
          Duplica
        </Button>
        <Button variant="danger" icon={<IconTrash size={16} />} onClick={deleteSelection}>
          Elimina
        </Button>
      </Section>
    </div>
  );
}

function VertexProps({ room, index }: { room: Room; index: number }) {
  const updateRoom = useEditor((s) => s.updateRoom);
  const p = room.polygon[index];
  if (!p) return null;
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <Section title={`Vertice ${index + 1} di ${room.name}`}>
        <NumberField label="X" value={p.x} onChange={(x) => updateRoom(room.id, (r) => setVertex(r, index, { x, y: p.y }))} width="w-20" />
        <NumberField label="Y" value={p.y} onChange={(y) => updateRoom(room.id, (r) => setVertex(r, index, { x: p.x, y }))} width="w-20" />
      </Section>
      <Section title="Azioni">
        <Button variant="danger" icon={<IconTrash size={16} />} onClick={deleteSelection} disabled={room.polygon.length <= 3}>
          Elimina vertice
        </Button>
      </Section>
      <p className="max-w-xs self-center text-sm text-muted">
        Trascina il vertice per spostarlo (Alt per muoverlo senza snap). Doppio clic su un muro per aggiungere un vertice.
      </p>
    </div>
  );
}
