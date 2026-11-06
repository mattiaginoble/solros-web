"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Button, NumberField, SelectField, TextField, formatNumber } from "@/components/ui/controls";
import { IconCopy, IconMerge, IconRotate, IconTrash, IconWarning } from "@/components/ui/icons";
import { OPENING_DEFAULTS, ROOM_COLOR_SWATCHES, ROOM_TYPES, ROOM_TYPE_COLOR, ROOM_TYPE_LABEL } from "@/domain/constants";
import { FLOOR_MATERIALS, FLOOR_MATERIAL_BY_ID, WALL_MATERIALS, WALL_MATERIAL_BY_ID } from "@/domain/materials";
import type { Opening, OpeningKind, PlacedItem, Room, RoomType } from "@/domain/schema";
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
import {
  deleteFloor,
  deleteSelection,
  duplicateSelection,
  fitToRoom,
  joinRoomTo,
  joinToNearest,
  openSharedWall,
  rotateSelection,
  updateFloor,
  updateItem,
} from "@/store/actions";
import { analyzeRoomItems, describeIssue } from "@/lib/geometry/placement";
import { formatMoney, formatPriceDate, formatTotals, quoteForRoom } from "@/lib/pricing/quote";
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
  else if (selection.kind === "item") {
    const it = loc.room.items.find((x) => x.id === selection.itemId);
    body = it ? <ItemProps room={loc.room} item={it} /> : null;
  } else body = null;

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
        <TextField label="Nome del piano" value={floor.name} onChange={(name) => updateFloor(floor.id, { name })} className="w-36" />
        <ReadValue label="Stanze" value={String(floor.rooms.length)} />
        <ReadValue label="Superficie netta" value={`${formatNumber(totalArea, 1)} m²`} />
        <NumberField
          label="Quota pavimento"
          value={floor.elevation}
          min={-2000}
          max={5000}
          onChange={(v) => updateFloor(floor.id, { elevation: v })}
          width="w-16"
        />
        <NumberField
          label="Spessore solaio"
          value={floor.slabThickness}
          min={0}
          max={100}
          onChange={(v) => updateFloor(floor.id, { slabThickness: v })}
          width="w-14"
        />
        {s.house.floors.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent">.</span>
            <Button
              variant="danger"
              icon={<IconTrash size={16} />}
              onClick={() => {
                if (confirm(`Eliminare ${floor.name} con tutte le sue stanze?`)) deleteFloor(floor.id);
              }}
            >
              Elimina piano
            </Button>
          </div>
        )}
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

      <RoomFurniture room={room} />
      {mode === "house" && <JoinSection room={room} />}

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
          <div className="flex flex-col gap-1">
            <span className="text-xs text-transparent">.</span>
            <Button onClick={() => openSharedWall(room.id, wallId)} title="Apre un passaggio lungo tutto il tratto in comune">
              Apri tutto il muro condiviso
            </Button>
          </div>
        )}
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

function RoomFurniture({ room }: { room: Room }) {
  if (room.items.length === 0) return null;
  const q = quoteForRoom(room);
  return (
    <Section title="Arredi">
      <ReadValue label="Oggetti" value={String(room.items.reduce((a, i) => a + (i.quantity ?? 1), 0))} />
      <ReadValue label="Totale indicativo" value={formatTotals(q.totals)} />
    </Section>
  );
}

function ItemProps({ room, item }: { room: Room; item: PlacedItem }) {
  const p = item.product;
  const issues = analyzeRoomItems(room).get(item.id) ?? [];
  const up = (patch: Partial<PlacedItem>) => updateItem(room.id, item.id, patch);
  const upProduct = (patch: Partial<PlacedItem["product"]>) => up({ product: { ...p, ...patch } });
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
      <Section title={p.name} aside={p.source === "demo" ? <span className="rounded border border-line-strong px-1 text-[10px] text-muted">dati demo</span> : undefined}>
        <ReadValue label="Rivenditore" value={p.retailer} />
        <NumberField label="Larghezza" value={p.width} min={1} max={2000} onChange={(v) => upProduct({ width: v })} width="w-16" />
        <NumberField label="Profondità" value={p.depth} min={1} max={2000} onChange={(v) => upProduct({ depth: v })} width="w-16" />
        <NumberField label="Altezza" value={p.height} min={1} max={1000} onChange={(v) => upProduct({ height: v })} width="w-16" />
      </Section>
      <Section title="Posizione">
        <NumberField label="X (nella stanza)" value={item.x} onChange={(x) => up({ x })} width="w-16" />
        <NumberField label="Y (nella stanza)" value={item.y} onChange={(y) => up({ y })} width="w-16" />
        <NumberField label="Rotazione" unit="°" value={item.rotation} min={-360} max={360} onChange={(v) => up({ rotation: ((v % 360) + 360) % 360 })} width="w-14" />
        {p.mount !== "ceiling" && (
          <NumberField
            label={p.mount === "wall" ? "Altezza da terra" : "Sollevato da terra"}
            value={item.elevation}
            min={0}
            max={Math.max(0, room.ceilingHeight - p.height)}
            onChange={(v) => up({ elevation: v })}
            width="w-16"
          />
        )}
      </Section>
      {p.shape === "stairs" && <StairsLink room={room} item={item} />}
      <Section title="Prezzo">
        <NumberField label="Quantità" unit="pz" value={item.quantity ?? 1} min={1} max={999} decimals={0} onChange={(v) => up({ quantity: Math.round(v) })} width="w-12" />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Prezzo indicativo</span>
          <span className="flex h-9 items-center gap-2 text-sm">
            <strong className="tabular-nums">{formatMoney(p.price * (item.quantity ?? 1), p.currency)}</strong>
            <span className="text-xs text-muted">al {formatPriceDate(p.priceUpdatedAt)}, può essere cambiato</span>
          </span>
        </div>
      </Section>
      {issues.length > 0 && (
        <Section title="Da controllare">
          <ul className="flex flex-col gap-1 text-sm text-danger">
            {issues.map((iss, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <IconWarning size={16} />
                {describeIssue(iss)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Azioni">
        <Button icon={<IconRotate size={16} />} onClick={() => rotateSelection(90)} title="Ruota di 90° (R), Alt+R per 15°">
          Ruota
        </Button>
        <Button icon={<IconCopy size={16} />} onClick={duplicateSelection}>
          Duplica
        </Button>
        {p.url && (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-[5px] border border-line-strong px-3.5 text-sm font-medium hover:border-graphite-soft">
            Apri il prodotto
          </a>
        )}
        <Button variant="danger" icon={<IconTrash size={16} />} onClick={deleteSelection}>
          Elimina
        </Button>
      </Section>
    </div>
  );
}

function JoinSection({ room }: { room: Room }) {
  const house = useEditor((s) => s.house);
  const activeFloorId = useEditor((s) => s.activeFloorId);
  const others = activeFloor({ house, activeFloorId }).rooms.filter((r) => r.id !== room.id);
  const [target, setTarget] = useState<string>("");
  if (others.length === 0) return null;
  const value = others.some((r) => r.id === target) ? target : others[0].id;
  return (
    <Section title="Unisci">
      <SelectField
        label="Accosta a"
        value={value}
        options={others.map((r) => ({ value: r.id, label: r.name }))}
        onChange={setTarget}
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-transparent">.</span>
        <div className="flex gap-2">
          <Button icon={<IconMerge size={16} />} onClick={() => joinRoomTo(room.id, value)}>
            Unisci
          </Button>
          <Button variant="ghost" onClick={() => joinToNearest(room.id)}>
            Alla più vicina
          </Button>
        </div>
      </div>
    </Section>
  );
}

function StairsLink({ room, item }: { room: Room; item: PlacedItem }) {
  const house = useEditor((s) => s.house);
  const loc = findRoom(house, room.id);
  const floors = house.floors.filter((f) => f.id !== loc?.floor.id).sort((a, b) => b.level - a.level);
  return (
    <Section title="Collegamento tra piani">
      <SelectField
        label="La scala porta a"
        value={item.linkFloorId ?? ""}
        options={[{ value: "", label: "Nessun piano" }, ...floors.map((f) => ({ value: f.id, label: f.name }))]}
        onChange={(v) => updateItem(room.id, item.id, { linkFloorId: v || undefined })}
      />
      {floors.length === 0 && (
        <p className="max-w-xs self-center text-sm text-muted">Aggiungi un piano dal selettore in alto per collegarlo con la scala.</p>
      )}
    </Section>
  );
}
