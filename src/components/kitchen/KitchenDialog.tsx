"use client";
import { useMemo, useState } from "react";
import { Button, Modal, NumberField, SelectField, Segmented } from "@/components/ui/controls";
import type { KitchenConfig, KitchenModule, Room } from "@/domain/schema";
import {
  CORNER_WIDTH,
  DEFAULT_CHOICES,
  applyKitchen,
  choicesFromConfig,
  composeKitchen,
  kitchenExtras,
  kitchenItems,
  runWidth,
  type KitchenChoices,
} from "@/kitchen/compose";
import { FRONTS, FRONT_BY_ID, HANDLES, WORKTOPS, WORKTOP_BY_ID } from "@/kitchen/options";
import { edgeLength } from "@/lib/geometry/polygon";
import { aggregateLines, formatMoney, formatPriceDate, lineFromItem, sumTotals } from "@/lib/pricing/quote";
import { findRoom, useEditor } from "@/store/editor";

/** Parete iniziale: la più lunga, fino alla prima porta. */
function defaultChoices(room: Room): KitchenChoices {
  if (room.kitchen) return choicesFromConfig(room, room.kitchen);
  let best = 0;
  let bestLen = -1;
  room.walls.forEach((w, i) => {
    const doors = room.openings.filter((o) => o.wallId === w.id && o.kind !== "window");
    const len = edgeLength(room.polygon, i) - doors.reduce((a, o) => a + o.width + 20, 0);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  });
  const wall = room.walls[best];
  const len = edgeLength(room.polygon, best);
  const firstDoor = room.openings.filter((o) => o.wallId === wall.id && o.kind !== "window").sort((a, b) => a.offset - b.offset)[0];
  const length = firstDoor ? Math.max(120, firstDoor.offset - 10) : len;
  const next = (best + 1) % room.polygon.length;
  return { ...DEFAULT_CHOICES, wallIndex: best, start: 0, length: Math.round(length), lengthB: Math.round(Math.min(240, edgeLength(room.polygon, next) - CORNER_WIDTH)) };
}

const MODULE_LABEL: Record<string, string> = {
  lavello: "Lavello",
  lavastoviglie: "Lavastoviglie",
  piano: "Piano cottura",
  "piano-forno": "Piano e forno",
  frigo: "Colonna frigo",
  forno: "Colonna forno",
  dispensa: "Dispensa",
  "frigo-libero": "Frigorifero",
  cassetti: "Cassetti",
  ante: "Ante",
  angolo: "Angolo",
};

function moduleLabel(m: KitchenModule) {
  if (m.kind === "filler") return "Compensatore";
  return MODULE_LABEL[m.variant ?? ""] ?? "Modulo";
}

/** Moduli con la loro posizione di partenza lungo la fila. */
function withOffsets(mods: KitchenModule[]) {
  return mods.map((m, i) => ({ m, x0: mods.slice(0, i).reduce((a, p) => a + p.width, 0) }));
}

/** Prospetto frontale di una fila: basi, pensili, colonne ed elettrodomestici. */
function Elevation({ run, front, worktop, index }: { run: KitchenConfig["runs"][number]; front: string; worktop: string; index: number }) {
  const total = runWidth(run.base);
  const H = 240;
  const pad = 14;
  const y = (cm: number) => H - cm; // quota da terra → coordinate SVG
  const bases = withOffsets(run.base);
  const walls = withOffsets(run.wall);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs text-muted">
        {index === 0 ? "Parete principale" : "Seconda parete"}, {Math.round(total)} cm
      </figcaption>
      <svg viewBox={`${-pad} ${-pad} ${total + pad * 2} ${H + pad * 2 + 18}`} className="w-full rounded-[4px] border border-line bg-white" style={{ maxHeight: 220 }}>
        <line x1={-pad} x2={total + pad} y1={H} y2={H} stroke="#9aa4a0" strokeWidth={1.5} />
        {bases.map(({ m, x0 }) => {
          const tall = m.kind === "tall";
          const h = tall ? 216 : m.variant === "frigo-libero" ? 186 : 88;
          const isAppliance = m.variant === "frigo-libero";
          return (
            <g key={m.id}>
              <rect x={x0 + 0.5} y={y(h)} width={m.width - 1} height={h - (tall || isAppliance ? 0 : 10)} fill={isAppliance ? "#d3d7da" : m.kind === "filler" ? "#e9e7e2" : front} stroke="#23272b" strokeWidth={1} />
              {!tall && !isAppliance && <rect x={x0 + 0.5} y={y(10)} width={m.width - 1} height={10} fill="#3b3f44" />}
              {m.variant === "cassetti" &&
                [0.33, 0.66].map((f) => <line key={f} x1={x0} x2={x0 + m.width} y1={y(10 + 78 * f)} y2={y(10 + 78 * f)} stroke="#23272b" />)}
              {(m.variant === "piano-forno" || m.variant === "forno") && (
                <rect x={x0 + 5} y={m.variant === "forno" ? y(155) : y(80)} width={m.width - 10} height={58} fill="#1d1f22" rx={2} />
              )}
              {m.variant === "lavastoviglie" && <line x1={x0 + 6} x2={x0 + m.width - 6} y1={y(80)} y2={y(80)} stroke="#23272b" />}
              {m.variant === "lavello" && <rect x={x0 + 8} y={y(92)} width={m.width - 16} height={4} fill="#9aa1a7" />}
              {(m.variant === "piano" || m.variant === "piano-forno") && <rect x={x0 + 4} y={y(94)} width={m.width - 8} height={3} fill="#111" />}
              <text x={x0 + m.width / 2} y={H + 13} textAnchor="middle" fontSize={10} fill="#1d4f91" fontFamily="var(--font-archivo-narrow)">
                {Math.round(m.width)}
              </text>
            </g>
          );
        })}
        <rect
          x={bases.find((b) => b.m.kind !== "tall" && b.m.variant !== "frigo-libero")?.x0 ?? 0}
          y={y(92)}
          width={bases.filter((b) => b.m.kind !== "tall" && b.m.variant !== "frigo-libero").reduce((a, b) => a + b.m.width, 0)}
          height={4}
          fill={worktop}
          stroke="#23272b"
          strokeWidth={0.5}
        />
        {walls.map(({ m, x0 }) =>
          m.kind === "wall" ? (
            <rect key={m.id} x={x0 + 0.5} y={y(217)} width={m.width - 1} height={72} fill={front} stroke="#23272b" strokeWidth={1} />
          ) : m.kind === "hood" ? (
            <path key={m.id} d={`M${x0 + m.width / 2 - 45} ${y(150)} h90 l-30 -25 v-60 h-30 v60 z`} fill="#c4c8cc" stroke="#23272b" />
          ) : null,
        )}
      </svg>
    </figure>
  );
}

export function KitchenDialog({ onClose }: { onClose: () => void }) {
  const house = useEditor((s) => s.house);
  const selection = useEditor((s) => s.selection);
  const focusedRoomId = useEditor((s) => s.focusedRoomId);
  const updateRoom = useEditor((s) => s.updateRoom);
  const roomId = focusedRoomId ?? selection?.roomId ?? null;
  const room = roomId ? findRoom(house, roomId)?.room ?? null : null;
  const [choices, setChoices] = useState<KitchenChoices | null>(() => (room ? defaultChoices(room) : null));
  const [edited, setEdited] = useState<KitchenConfig | null>(null);
  const composed = useMemo(() => (room && choices ? composeKitchen(room, choices) : null), [room, choices]);
  const config = edited ?? composed;
  const preview = useMemo(() => (room && config ? applyKitchen(room, config) : null), [room, config]);
  const bom = useMemo(() => {
    if (!preview) return null;
    const lines = aggregateLines([...kitchenItems(preview, config!).map(lineFromItem), ...kitchenExtras(preview)]);
    return { lines, totals: sumTotals(lines) };
  }, [preview, config]);

  if (!room || !choices || !config) {
    return (
      <Modal title="Configuratore cucina" onClose={onClose}>
        <p className="text-sm">Seleziona prima la stanza in cui comporre la cucina, poi riapri il configuratore.</p>
      </Modal>
    );
  }
  const set = (patch: Partial<KitchenChoices>) => {
    setEdited(null);
    setChoices({ ...choices, ...patch });
  };
  const n = room.polygon.length;
  const wallOptions = room.walls.map((w, i) => ({
    value: String(i),
    label: `Lato ${i + 1} (${Math.round(edgeLength(room.polygon, i))} cm)${choices.layout === "corner" ? ` + lato ${((i + 1) % n) + 1}` : ""}`,
  }));
  const wallLen = edgeLength(room.polygon, choices.wallIndex);
  const wallLenB = edgeLength(room.polygon, (choices.wallIndex + 1) % n);
  const front = FRONT_BY_ID[choices.frontId] ?? FRONTS[0];
  const worktop = WORKTOP_BY_ID[choices.worktopId] ?? WORKTOPS[0];

  /** Modifica manuale della larghezza di un modulo: il compensatore della fila assorbe la differenza. */
  const editModule = (runIdx: number, modId: string, width: number) => {
    const runs = config.runs.map((r, i) => {
      if (i !== runIdx) return r;
      const base = r.base.map((m) => (m.id === modId ? { ...m, width } : m));
      const without = base.filter((m) => m.kind !== "filler");
      const rest = r.length - runWidth(without);
      if (rest < 0) {
        useEditor.getState().notify("Il modulo non entra: riduci un altro modulo o allunga la composizione", "warning");
        return r;
      }
      const filler = base.find((m) => m.kind === "filler");
      const nextBase = rest >= 1 ? [...without, { ...(filler ?? { id: `${modId}-f`, kind: "filler" }), width: Math.round(rest * 10) / 10 }] : without;
      const wall = nextBase.map((m, k) => {
        const old = r.wall.find((_, j) => r.base[j]?.id === m.id) ?? r.wall[k];
        if (!old || old.kind === "gap" || (m.width !== old.width && ![40, 60, 80].includes(m.width))) return { id: `${m.id}-w`, kind: "gap", width: m.width };
        return { ...old, width: m.width };
      });
      return { ...r, base: nextBase, wall };
    });
    setEdited({ ...config, runs });
  };

  return (
    <Modal
      title={`Configuratore cucina: ${room.name}`}
      onClose={onClose}
      width="max-w-6xl"
      footer={
        <>
          {room.kitchen && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                updateRoom(room.id, (r) => applyKitchen(r, null));
                onClose();
              }}
            >
              Rimuovi la cucina
            </Button>
          )}
          <Button onClick={onClose}>Annulla</Button>
          <Button
            variant="primary"
            onClick={() => {
              updateRoom(room.id, (r) => applyKitchen(r, config));
              onClose();
              useEditor.getState().notify("Cucina applicata alla stanza: moduli ed elettrodomestici sono in pianta e nel preventivo");
            }}
          >
            {room.kitchen ? "Aggiorna la cucina" : "Applica alla stanza"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <Segmented<"linear" | "corner">
            label="Composizione"
            value={choices.layout}
            onChange={(layout) => set({ layout })}
            options={[
              { value: "linear", label: "Lineare" },
              { value: "corner", label: "Ad angolo" },
            ]}
          />
          <SelectField label="Parete" value={String(choices.wallIndex)} options={wallOptions} onChange={(v) => set({ wallIndex: Number(v), start: 0, length: Math.round(edgeLength(room.polygon, Number(v))) })} />
          <div className="flex flex-wrap gap-3">
            {choices.layout === "linear" && (
              <NumberField label="Distanza dall’angolo" value={choices.start} min={0} max={Math.max(0, wallLen - 60)} onChange={(v) => set({ start: v })} width="w-16" />
            )}
            <NumberField label={choices.layout === "corner" ? "Lunghezza lato 1" : "Lunghezza"} value={choices.length} min={choices.layout === "corner" ? 150 : 60} max={wallLen} onChange={(v) => set({ length: v })} width="w-16" />
            {choices.layout === "corner" && (
              <NumberField label="Lunghezza lato 2" value={choices.lengthB} min={60} max={Math.max(60, wallLenB - CORNER_WIDTH)} onChange={(v) => set({ lengthB: v })} width="w-16" />
            )}
          </div>
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="mb-1 text-[13px] font-semibold">Elettrodomestici</legend>
            <SelectField
              label="Frigorifero"
              value={choices.fridge}
              options={[
                { value: "tall", label: "Da incasso in colonna" },
                { value: "freestanding", label: "Libera installazione" },
                { value: "none", label: "Nessuno" },
              ]}
              onChange={(fridge) => set({ fridge })}
            />
            <SelectField
              label="Forno"
              value={choices.oven}
              options={[
                { value: "under", label: "Sotto il piano" },
                { value: "tall", label: "In colonna" },
                { value: "none", label: "Nessuno" },
              ]}
              onChange={(oven) => set({ oven })}
            />
            <SelectField
              label="Piano cottura"
              value={choices.cooktop}
              options={[
                { value: "induction-60", label: "Induzione 60 cm" },
                { value: "induction-80", label: "Induzione 80 cm" },
                { value: "gas-60", label: "Gas 60 cm" },
                { value: "none", label: "Nessuno" },
              ]}
              onChange={(cooktop) => set({ cooktop })}
            />
            <SelectField
              label="Cappa"
              value={choices.hood}
              options={[
                { value: "under-cabinet", label: "Sottopensile 60" },
                { value: "wall-90", label: "A parete 90" },
                { value: "none", label: "Nessuna" },
              ]}
              onChange={(hood) => set({ hood })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={choices.dishwasher} onChange={(e) => set({ dishwasher: e.target.checked })} />
              Lavastoviglie
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={choices.sink} onChange={(e) => set({ sink: e.target.checked })} />
              Lavello
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={choices.wallCabinets} onChange={(e) => set({ wallCabinets: e.target.checked })} />
              Pensili
            </label>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-semibold">Frontali</legend>
            <div className="flex flex-wrap gap-2">
              {FRONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={choices.frontId === f.id}
                  title={`${f.label}${f.pricePerCm ? `, +${formatMoney(f.pricePerCm * 100)} al metro` : ""}`}
                  onClick={() => setChoices({ ...choices, frontId: f.id })}
                  className={`flex items-center gap-1.5 rounded-[5px] border px-2 py-1 text-xs ${choices.frontId === f.id ? "border-prussian bg-prussian-tint" : "border-line-strong"}`}
                >
                  <span className="h-4 w-4 rounded-[3px] border border-line-strong" style={{ background: f.color }} />
                  {f.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Maniglie" value={choices.handleId} options={HANDLES.map((h) => ({ value: h.id, label: h.label }))} onChange={(handleId) => setChoices({ ...choices, handleId })} />
            <SelectField label="Top" value={choices.worktopId} options={WORKTOPS.map((w) => ({ value: w.id, label: w.label }))} onChange={(worktopId) => setChoices({ ...choices, worktopId })} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {config.runs.map((run, i) => (
            <div key={run.id} className="flex flex-col gap-2">
              <Elevation run={run} front={front.color} worktop={worktop.color} index={i} />
              <div className="flex flex-wrap gap-1.5">
                {run.base.map((m) => (
                  <label key={m.id} className="flex items-center gap-1 rounded-[5px] border border-line px-1.5 py-1 text-xs">
                    <span className="text-graphite-soft">{moduleLabel(m)}</span>
                    {m.kind === "base" && (m.variant === "ante" || m.variant === "cassetti") ? (
                      <select
                        aria-label={`Larghezza ${moduleLabel(m)}`}
                        value={m.width}
                        onChange={(e) => editModule(i, m.id, Number(e.target.value))}
                        className="rounded border border-line-strong bg-panel"
                      >
                        {[30, 40, 60, 80].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="tabular-nums">{Math.round(m.width)}</span>
                    )}
                  </label>
                ))}
                {edited && (
                  <button type="button" className="text-xs font-medium text-prussian underline" onClick={() => setEdited(null)}>
                    Riempi di nuovo in automatico
                  </button>
                )}
              </div>
            </div>
          ))}

          {bom && (
            <div className="rounded-[6px] border border-line">
              <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
                <h3 className="text-sm font-semibold">Elenco componenti</h3>
                <span className="text-lg font-semibold tabular-nums">{formatMoney(bom.totals.EUR ?? 0)}</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <tbody>
                    {bom.lines.map((l) => (
                      <tr key={l.key} className="border-b border-line/60">
                        <td className="px-3 py-1">{l.name}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{l.quantity}</td>
                        <td className="px-3 py-1 text-right tabular-nums">{formatMoney(l.total, l.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">
                Dati demo, prezzi indicativi al {formatPriceDate("2026-10-15T00:00:00.000Z")}: possono essere cambiati.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
