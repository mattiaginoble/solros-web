"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Modal } from "@/components/ui/controls";
import { PlanPreview } from "@/components/ui/PlanPreview";
import { cloneHouseWithNewIds, createHouse } from "@/domain/factory";
import { safeParseHouse } from "@/domain/schema";
import { ROOM_TEMPLATES } from "@/domain/templates";
import { api, type ProjectSummary } from "@/lib/client/api";
import { editorHref, FULL_APP_URL, STATIC_MODE } from "@/lib/client/mode";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

/** Disegni delle tre scelte iniziali: tratti a matita sulla carta millimetrata. */
function DrawRoomArt() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <path d="M40 30h110v62H40z" fill="#fde2b3" stroke="#23272b" strokeWidth="6" strokeLinejoin="miter" />
      <path d="M40 16h110M40 11v10M150 11v10" stroke="#1d4f91" strokeWidth="1.4" />
      <path d="M37 19l6-6M147 19l6-6" stroke="#1d4f91" strokeWidth="2" />
      <text x="95" y="12" textAnchor="middle" fontSize="9" fill="#1d4f91" fontFamily="var(--font-archivo-narrow)">
        400
      </text>
      <circle cx="40" cy="30" r="4" fill="#fff" stroke="#1d4f91" strokeWidth="1.6" />
      <circle cx="150" cy="30" r="4" fill="#fff" stroke="#1d4f91" strokeWidth="1.6" />
      <circle cx="150" cy="92" r="4" fill="#1d4f91" />
    </svg>
  );
}

function UploadPlanArt() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <rect x="38" y="14" width="124" height="92" fill="#fff" stroke="#c7d0cc" />
      <path d="M50 26h60v34H50zM110 26h40v54h-40M50 60v34h60" fill="none" stroke="#8a9590" strokeWidth="3" />
      <path d="M50 100h60" stroke="#1d4f91" strokeWidth="1.4" strokeDasharray="3 3" />
      <circle cx="50" cy="100" r="3.5" fill="#1d4f91" />
      <circle cx="110" cy="100" r="3.5" fill="#1d4f91" />
      <rect x="64" y="104" width="32" height="12" rx="2" fill="#1d4f91" />
      <text x="80" y="113" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="var(--font-archivo-narrow)">
        3,00 m
      </text>
    </svg>
  );
}

function TemplatesArt() {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <rect x="70" y="14" width="86" height="64" fill="#fff" stroke="#c7d0cc" transform="rotate(6 113 46)" />
      <rect x="56" y="24" width="86" height="64" fill="#fff" stroke="#c7d0cc" transform="rotate(-3 99 56)" />
      <g transform="translate(44 36)">
        <rect width="86" height="64" fill="#fff" stroke="#c7d0cc" />
        <path d="M12 10h40v26H34v18H12z" fill="#c8ecf5" stroke="#23272b" strokeWidth="4" />
        <path d="M58 10h18v44H58z" fill="#d8e2fc" stroke="#23272b" strokeWidth="4" />
      </g>
    </svg>
  );
}

function ProjectSheet({
  p,
  actions,
  href,
}: {
  p: ProjectSummary;
  actions: React.ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className="paper-grid flex h-40 items-center justify-center border-b border-line-strong">
        {p.preview.length ? (
          <PlanPreview shapes={p.preview} className="h-32 w-full px-4" wall={12} />
        ) : (
          <span className="text-sm text-muted">Nessuna stanza</span>
        )}
      </div>
      {/* Cartiglio: le informazioni della tavola, come nei disegni tecnici. */}
      <div className="grid grid-cols-[1fr_auto] text-sm">
        <div className="col-span-2 border-b border-line px-3 py-2">
          <span className="block truncate font-semibold">{p.name}</span>
        </div>
        <div className="border-r border-line px-3 py-1.5">
          <span className="block text-[11px] text-muted">Superficie</span>
          <span className="tabular-nums">{p.stats.areaM2.toLocaleString("it-IT")} m²</span>
        </div>
        <div className="px-3 py-1.5">
          <span className="block text-[11px] text-muted">Stanze</span>
          <span className="tabular-nums">{p.stats.rooms}</span>
        </div>
        <div className="col-span-2 border-t border-line px-3 py-1.5 text-[12px] text-muted">
          {p.isExample ? "Casa di esempio" : `Aggiornato il ${formatDate(p.updatedAt)}`}
          {p.stats.floors > 1 ? `, ${p.stats.floors} piani` : ""}
        </div>
      </div>
    </>
  );
  return (
    <li className="flex flex-col overflow-hidden rounded-[4px] border border-line-strong bg-panel">
      {href ? (
        <Link href={href} className="block hover:bg-panel-sunk">
          {body}
        </Link>
      ) : (
        body
      )}
      <div className="mt-auto flex gap-1.5 border-t border-line bg-panel-sunk px-2 py-2">{actions}</div>
    </li>
  );
}

export function HomeClient() {
  const router = useRouter();
  const [data, setData] = useState<{ projects: ProjectSummary[]; examples: ProjectSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const load = useCallback(() => {
    api
      .listProjects()
      .then((d) => setData({ projects: d.projects, examples: d.examples }))
      .catch(() => setError("Impossibile caricare i progetti. Verifica che il server sia avviato."));
  }, []);
  useEffect(load, [load]);

  const createAndOpen = async (action: string, house = createHouse("Nuova casa")) => {
    setBusy(true);
    try {
      const { project } = await api.createProject({ data: house });
      router.push(editorHref(project.id, action));
    } catch {
      setError("Non è stato possibile creare il progetto.");
      setBusy(false);
    }
  };

  const startFromTemplate = async (templateId: string) => {
    const t = ROOM_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const house = createHouse(t.name);
    house.floors[0].rooms.push(t.build());
    await createAndOpen("nessuna", house);
  };

  const startFromExample = async (exampleId: string) => {
    setBusy(true);
    try {
      const { project } = await api.createProject({ fromExampleId: exampleId });
      router.push(editorHref(project.id));
    } catch {
      setError("Non è stato possibile copiare la casa di esempio.");
      setBusy(false);
    }
  };

  const choices = [
    {
      title: "Crea una stanza",
      text: "Parti dalle misure: larghezza e lunghezza, poi aggiungi porte, finestre e altre stanze.",
      art: <DrawRoomArt />,
      onClick: () => createAndOpen("rettangolo"),
    },
    {
      title: "Carica una planimetria",
      text: "Usa un PNG, JPG o PDF come sfondo: imposta la scala e ricalca le stanze, oppure lascia che vengano riconosciute.",
      art: <UploadPlanArt />,
      onClick: () => createAndOpen("planimetria"),
    },
    {
      title: "Parti da un modello",
      text: "Scegli una stanza pronta o una casa di esempio e adattala alle tue misure.",
      art: <TemplatesArt />,
      onClick: () => setShowTemplates(true),
    },
  ];

  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-[15px] font-semibold">Configuratore Casa</span>
      </header>
      {STATIC_MODE && (
        <div className="mx-auto max-w-6xl px-5">
          <p role="note" className="rounded-[6px] border border-warning/40 bg-warning-tint px-4 py-3 text-sm leading-relaxed text-graphite">
            <strong className="font-semibold">Versione dimostrativa senza server.</strong> I progetti e i prodotti che aggiungi restano
            salvati solo in questo browser: esportali in JSON per conservarli. Prodotti da link, analisi delle planimetrie con Claude e
            link di condivisione sono disponibili nella versione completa
            {FULL_APP_URL ? (
              <>
                :{" "}
                <a href={FULL_APP_URL} className="font-medium text-prussian underline">
                  apri la versione completa
                </a>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="pb-10 pt-6 sm:pt-12">
          <h1 className="max-w-3xl text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.02em] [font-stretch:88%]">
            Disegna la tua casa stanza per stanza, poi arredala con prodotti veri.
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-graphite-soft">
            Misure al centimetro, muri che si uniscono da soli, vista 3D e un preventivo con i prezzi dei rivenditori.
          </p>
        </section>

        <section aria-label="Come vuoi iniziare" className="grid gap-4 md:grid-cols-3">
          {choices.map((c) => (
            <button
              key={c.title}
              type="button"
              disabled={busy}
              onClick={c.onClick}
              className="group flex flex-col overflow-hidden rounded-[4px] border border-line-strong bg-panel text-left transition-colors hover:border-prussian disabled:opacity-60"
            >
              <span className="paper-grid block h-40 border-b border-line-strong p-3">{c.art}</span>
              <span className="flex flex-1 flex-col gap-1.5 p-4">
                <span className="text-lg font-semibold group-hover:text-prussian">{c.title}</span>
                <span className="text-sm leading-relaxed text-graphite-soft">{c.text}</span>
              </span>
            </button>
          ))}
        </section>

        {error && (
          <p role="alert" className="mt-6 rounded-[5px] border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <section className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">I tuoi progetti</h2>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-[5px] border border-line-strong bg-panel px-3 text-sm font-medium hover:border-graphite-soft">
              Importa progetto (JSON)
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const raw = JSON.parse(await file.text());
                    const candidate = raw && raw.format === "configuratore-casa" ? raw.house : raw;
                    const parsed = safeParseHouse(candidate);
                    if (!parsed.success) throw new Error("invalid");
                    setBusy(true);
                    const { project } = await api.createProject({ data: cloneHouseWithNewIds(parsed.data) });
                    router.push(editorHref(project.id));
                  } catch {
                    setBusy(false);
                    setError("Il file non è un progetto valido del Configuratore Casa.");
                  }
                }}
              />
            </label>
          </div>
          {!data ? (
            <p className="mt-3 text-sm text-muted">Caricamento…</p>
          ) : data.projects.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Non hai ancora progetti: scegli uno dei tre modi qui sopra per iniziare.</p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.projects.map((p) => (
                <ProjectSheet
                  key={p.id}
                  p={p}
                  href={editorHref(p.id)}
                  actions={
                    <>
                      <Button size="sm" variant="primary" onClick={() => router.push(editorHref(p.id))}>
                        Apri
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await api.duplicateProject(p.id);
                          load();
                        }}
                      >
                        Duplica
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="ml-auto"
                        onClick={async () => {
                          if (!confirm(`Eliminare definitivamente «${p.name}»?`)) return;
                          await api.deleteProject(p.id);
                          load();
                        }}
                      >
                        Elimina
                      </Button>
                    </>
                  }
                />
              ))}
            </ul>
          )}
        </section>

        {data && data.examples.length > 0 && (
          <section className="mt-14">
            <h2 className="text-xl font-semibold">Case di esempio</h2>
            <p className="mt-1 text-sm text-muted">Aprile come base: ne viene creata una copia modificabile tra i tuoi progetti.</p>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.examples.map((p) => (
                <ProjectSheet
                  key={p.id}
                  p={p}
                  actions={
                    <>
                      <Button size="sm" variant="primary" disabled={busy} onClick={() => startFromExample(p.id)}>
                        Usa come base
                      </Button>
                      <Button size="sm" onClick={() => router.push(editorHref(p.id))}>
                        Guarda
                      </Button>
                    </>
                  }
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      {showTemplates && (
        <Modal title="Parti da un modello" onClose={() => setShowTemplates(false)} width="max-w-3xl">
          <h3 className="text-sm font-semibold">Stanze pronte</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROOM_TEMPLATES.map((t) => {
              const room = t.build();
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startFromTemplate(t.id)}
                    className="flex w-full flex-col gap-1 rounded-[5px] border border-line p-2 text-left hover:border-prussian"
                  >
                    <span className="paper-grid flex h-20 items-center justify-center rounded-[3px] border border-line">
                      <PlanPreview shapes={[{ points: room.polygon, color: room.color }]} className="h-16 w-full" />
                    </span>
                    <span className="text-[13px] font-medium leading-tight">{t.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {data && data.examples.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold">Case di esempio</h3>
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.examples.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startFromExample(p.id)}
                      className="flex w-full flex-col gap-1 rounded-[5px] border border-line p-2 text-left hover:border-prussian"
                    >
                      <span className="paper-grid flex h-24 items-center justify-center rounded-[3px] border border-line">
                        <PlanPreview shapes={p.preview} className="h-20 w-full" wall={12} />
                      </span>
                      <span className="text-[13px] font-medium">{p.name}</span>
                      <span className="text-[11px] text-muted">
                        {p.stats.rooms} stanze, {p.stats.areaM2.toLocaleString("it-IT")} m²
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
