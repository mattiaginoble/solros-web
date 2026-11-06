"use client";
import { useState } from "react";
import { Button, Modal, NumberField, SelectField, TextField } from "@/components/ui/controls";
import { ROOM_TYPES, ROOM_TYPE_LABEL } from "@/domain/constants";
import { createRectRoom } from "@/domain/factory";
import type { RoomType } from "@/domain/schema";
import { addRoom, fitToFloor } from "@/store/actions";
import { useEditor } from "@/store/editor";
import { TemplatesList } from "./RightPanel";

function RectRoomDialog({ onClose }: { onClose: () => void }) {
  const settings = useEditor((s) => s.house.settings);
  const [width, setWidth] = useState(400);
  const [length, setLength] = useState(350);
  const [type, setType] = useState<RoomType>("camera");
  const [name, setName] = useState("");
  const [thickness, setThickness] = useState(settings.defaultWallThickness);
  const [height, setHeight] = useState(settings.defaultCeilingHeight);
  const create = () => {
    const room = createRectRoom(width, length, {
      type,
      name: name.trim() || ROOM_TYPE_LABEL[type],
      wallThickness: thickness,
      ceilingHeight: height,
    });
    addRoom(room, { place: "auto" });
    onClose();
    requestAnimationFrame(() => fitToFloor());
  };
  return (
    <Modal
      title="Nuova stanza rettangolare"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annulla</Button>
          <Button variant="primary" onClick={create}>
            Crea stanza
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <NumberField label="Larghezza interna" value={width} min={50} max={3000} onChange={setWidth} width="w-full" />
        <NumberField label="Lunghezza interna" value={length} min={50} max={3000} onChange={setLength} width="w-full" />
        <SelectField
          label="Tipo di stanza"
          value={type}
          options={ROOM_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          onChange={setType}
        />
        <TextField label="Nome (facoltativo)" value={name} onChange={setName} placeholder={ROOM_TYPE_LABEL[type]} />
        <NumberField label="Spessore muri" value={thickness} min={1} max={80} onChange={setThickness} width="w-full" />
        <NumberField label="Altezza soffitto" value={height} min={150} max={800} onChange={setHeight} width="w-full" />
        <p className="col-span-2 text-sm text-muted">
          Superficie: {((width * length) / 10000).toLocaleString("it-IT", { maximumFractionDigits: 2 })} m². Le misure sono
          interne, al netto dei muri.
        </p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

function TemplatesDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Modelli di stanza" onClose={onClose} width="max-w-2xl">
      <p className="mb-1 text-sm text-muted">Il modello viene affiancato alle stanze esistenti e resta modificabile in ogni misura.</p>
      <div className="-mx-3">
        <TemplatesList
          onPicked={() => {
            onClose();
            requestAnimationFrame(() => fitToFloor());
          }}
        />
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ["V", "Seleziona"],
  ["D", "Disegna i muri di una stanza"],
  ["P / F", "Inserisci porta / finestra"],
  ["Canc", "Elimina la selezione"],
  ["Ctrl+Z / Ctrl+Maiusc+Z", "Annulla / ripeti"],
  ["Ctrl+D", "Duplica"],
  ["R / Maiusc+R", "Ruota di 90° in senso orario / antiorario"],
  ["Alt+R", "Ruota di 15° (oggetti)"],
  ["Frecce", "Sposta di 1 cm (Maiusc: 10 cm)"],
  ["Invio", "Modifica la stanza selezionata"],
  ["Esc", "Esci dallo strumento o dalla stanza"],
  ["+ / − / 0", "Zoom avanti, indietro, inquadra tutto"],
  ["Ctrl+S", "Salva subito"],
];

function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Scorciatoie e suggerimenti" onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="rounded border border-line-strong bg-panel-sunk px-1.5 py-0.5 text-xs font-medium">{k}</kbd>
            </dt>
            <dd className="text-graphite-soft">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted">
        Su tablet: un dito sposta la pianta, due dita per lo zoom. Doppio tocco su una stanza per modificarla.
      </p>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useEditor((s) => s.dialog);
  const openDialog = useEditor((s) => s.openDialog);
  const close = () => openDialog(null);
  if (dialog === "rect") return <RectRoomDialog onClose={close} />;
  if (dialog === "templates") return <TemplatesDialog onClose={close} />;
  if (dialog === "help") return <HelpDialog onClose={close} />;
  return null;
}
