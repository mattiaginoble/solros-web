/** Libreria di modelli di stanza pronti all'uso. */
import { createOpening, createRoom } from "./factory";
import type { Room, RoomType } from "./schema";
import { lShapePolygon, rectPolygon } from "@/lib/geometry/polygon";

export interface RoomTemplate {
  id: string;
  name: string;
  type: RoomType;
  description: string;
  /** Dimensioni indicative per la scheda (cm). */
  width: number;
  length: number;
  build: () => Room;
}

/** Aggiunge porte e finestre per indice di lato. */
function withOpenings(
  room: Room,
  list: { wall: number; kind: "door" | "window" | "passage"; offset: number; width?: number; height?: number; sill?: number }[],
): Room {
  return {
    ...room,
    openings: list.map((o) =>
      createOpening(o.kind, room.walls[o.wall].id, o.offset, {
        ...(o.width ? { width: o.width } : {}),
        ...(o.height ? { height: o.height } : {}),
        ...(o.sill !== undefined ? { sill: o.sill } : {}),
      }),
    ),
  };
}

export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: "bagno-200x250",
    name: "Bagno 2 × 2,5 m",
    type: "bagno",
    description: "Bagno compatto con porta da 70 cm e finestra",
    width: 200,
    length: 250,
    build: () =>
      withOpenings(createRoom({ type: "bagno", polygon: rectPolygon(200, 250) }), [
        { wall: 2, kind: "door", offset: 20, width: 70 },
        { wall: 0, kind: "window", offset: 60, width: 80, height: 100, sill: 110 },
      ]),
  },
  {
    id: "bagno-250x300",
    name: "Bagno 2,5 × 3 m",
    type: "bagno",
    description: "Bagno con spazio per doccia e vasca",
    width: 250,
    length: 300,
    build: () =>
      withOpenings(createRoom({ type: "bagno", polygon: rectPolygon(250, 300) }), [
        { wall: 3, kind: "door", offset: 200, width: 80 },
        { wall: 0, kind: "window", offset: 80, width: 90, height: 120, sill: 100 },
      ]),
  },
  {
    id: "cucina-lineare",
    name: "Cucina lineare 2,5 × 3,5 m",
    type: "cucina",
    description: "Cucina con parete attrezzabile da 3,5 m",
    width: 350,
    length: 250,
    build: () =>
      withOpenings(createRoom({ type: "cucina", polygon: rectPolygon(350, 250) }), [
        { wall: 2, kind: "door", offset: 240, width: 80 },
        { wall: 1, kind: "window", offset: 70, width: 110, sill: 100, height: 130 },
      ]),
  },
  {
    id: "cucina-l",
    name: "Cucina a L 3 × 3,5 m",
    type: "cucina",
    description: "Ambiente adatto a una composizione ad angolo",
    width: 350,
    length: 300,
    build: () =>
      withOpenings(createRoom({ type: "cucina", polygon: rectPolygon(350, 300) }), [
        { wall: 2, kind: "passage", offset: 180, width: 120 },
        { wall: 1, kind: "window", offset: 160, width: 100, sill: 100, height: 130 },
      ]),
  },
  {
    id: "camera-matrimoniale",
    name: "Camera matrimoniale 3,5 × 4 m",
    type: "camera",
    description: "Spazio per letto 160, armadio e comodini",
    width: 350,
    length: 400,
    build: () =>
      withOpenings(createRoom({ type: "camera", polygon: rectPolygon(350, 400) }), [
        { wall: 3, kind: "door", offset: 300, width: 80 },
        { wall: 1, kind: "window", offset: 140, width: 120 },
      ]),
  },
  {
    id: "cameretta",
    name: "Cameretta 3 × 3,3 m",
    type: "cameretta",
    description: "Letto singolo, scrivania e armadio",
    width: 300,
    length: 330,
    build: () =>
      withOpenings(createRoom({ type: "cameretta", polygon: rectPolygon(300, 330) }), [
        { wall: 3, kind: "door", offset: 230, width: 80 },
        { wall: 0, kind: "window", offset: 100, width: 100 },
      ]),
  },
  {
    id: "soggiorno-l",
    name: "Soggiorno a L 6 × 5 m",
    type: "soggiorno",
    description: "Zona giorno a L con portafinestra",
    width: 600,
    length: 500,
    build: () =>
      withOpenings(createRoom({ type: "soggiorno", polygon: lShapePolygon(600, 500, 220, 200) }), [
        { wall: 0, kind: "window", offset: 150, width: 180, height: 230, sill: 0 },
        { wall: 5, kind: "door", offset: 60, width: 90 },
        { wall: 3, kind: "passage", offset: 40, width: 120 },
      ]),
  },
  {
    id: "studio",
    name: "Studio 2,8 × 3 m",
    type: "studio",
    description: "Postazione di lavoro con libreria",
    width: 280,
    length: 300,
    build: () =>
      withOpenings(createRoom({ type: "studio", polygon: rectPolygon(280, 300) }), [
        { wall: 3, kind: "door", offset: 200, width: 80 },
        { wall: 0, kind: "window", offset: 90, width: 100 },
      ]),
  },
  {
    id: "corridoio",
    name: "Corridoio 1,2 × 4 m",
    type: "corridoio",
    description: "Disimpegno di collegamento",
    width: 120,
    length: 400,
    build: () => createRoom({ type: "corridoio", polygon: rectPolygon(120, 400) }),
  },
  {
    id: "ingresso",
    name: "Ingresso 2 × 2 m",
    type: "ingresso",
    description: "Ingresso con portoncino da 90 cm",
    width: 200,
    length: 200,
    build: () =>
      withOpenings(createRoom({ type: "ingresso", polygon: rectPolygon(200, 200) }), [
        { wall: 2, kind: "door", offset: 55, width: 90 },
      ]),
  },
  {
    id: "ripostiglio",
    name: "Ripostiglio 1,5 × 1,5 m",
    type: "ripostiglio",
    description: "Locale di servizio",
    width: 150,
    length: 150,
    build: () =>
      withOpenings(createRoom({ type: "ripostiglio", polygon: rectPolygon(150, 150) }), [
        { wall: 3, kind: "door", offset: 40, width: 70 },
      ]),
  },
  {
    id: "lavanderia",
    name: "Lavanderia 1,8 × 2,2 m",
    type: "lavanderia",
    description: "Spazio per lavatrice e asciugatrice",
    width: 180,
    length: 220,
    build: () =>
      withOpenings(createRoom({ type: "lavanderia", polygon: rectPolygon(180, 220) }), [
        { wall: 2, kind: "door", offset: 50, width: 70 },
      ]),
  },
];

export const ROOM_TEMPLATE_BY_ID = Object.fromEntries(ROOM_TEMPLATES.map((t) => [t.id, t]));
