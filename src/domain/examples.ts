/**
 * Case di esempio caricate dal seed. Le stanze sono accostate alla distanza
 * dello spessore dei muri interni, quindi i muri condivisi vengono riconosciuti
 * automaticamente; i muri perimetrali sono più spessi.
 */
import { DEMO_PRODUCTS } from "@/catalog/demoData";
import { createFloor, createHouse, createOpening, createPlacedItem, createRoom } from "./factory";
import type { House, OpeningKind, PlacedItem, Room, RoomType } from "./schema";
import { rectPolygon } from "@/lib/geometry/polygon";

const EXT = 30;
const INT = 10;

function product(id: string) {
  const p = DEMO_PRODUCTS.find((x) => x.id === `demo-${id}`);
  if (!p) throw new Error(`Prodotto demo mancante: ${id}`);
  return p;
}

/** Stanza rettangolare nel piano; `ext` indica quali lati (alto, destra, basso, sinistra) sono perimetrali. */
function rect(
  type: RoomType,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  ext: [boolean, boolean, boolean, boolean],
): Room {
  return createRoom({
    type,
    name,
    polygon: rectPolygon(w, h, x, y),
    wallThickness: ext.map((e) => (e ? EXT : INT)),
  });
}

/** Aggiunge un'apertura sul lato (0 alto, 1 destra, 2 basso, 3 sinistra) di una stanza rettangolare. */
function opening(
  room: Room,
  side: number,
  kind: OpeningKind,
  offset: number,
  width: number,
  extra: { height?: number; sill?: number; hinge?: "start" | "end"; swing?: "in" | "out" } = {},
) {
  room.openings.push(createOpening(kind, room.walls[side].id, offset, { width, ...extra }));
}

/** Aggiunge un oggetto indicandone il centro in coordinate di piano (le stanze non sono ruotate). */
function put(room: Room, id: string, x: number, y: number, rotation = 0, elevation?: number): PlacedItem {
  const it = createPlacedItem(product(id), x - room.x, y - room.y, rotation, elevation);
  room.items.push(it);
  return it;
}

function bilocale(): House {
  const h = createHouse("Bilocale 55 m²");
  const f = h.floors[0];
  const living = rect("soggiorno", "Soggiorno con cucina", 0, 0, 600, 450, [true, true, false, true]);
  const bedroom = rect("camera", "Camera", 0, 460, 380, 350, [false, false, true, true]);
  const bath = rect("bagno", "Bagno", 390, 460, 210, 240, [false, true, false, false]);
  const storage = rect("ripostiglio", "Ripostiglio", 390, 710, 210, 100, [false, true, true, false]);

  opening(living, 0, "window", 80, 160, { height: 230, sill: 0 });
  opening(living, 0, "window", 400, 120);
  opening(living, 3, "door", 150, 90);
  opening(bedroom, 0, "door", 220, 80);
  opening(bedroom, 3, "window", 120, 120);
  opening(bedroom, 2, "window", 130, 120);
  opening(bath, 0, "door", 100, 70, { hinge: "end" });
  opening(bath, 1, "window", 80, 70, { height: 100, sill: 110 });
  opening(storage, 3, "door", 15, 70);

  // Cucina lineare lungo la parete destra del soggiorno.
  put(living, "frigo-libera", 567, 40, 90);
  put(living, "base-lavello-80", 570, 110, 90);
  put(living, "base-60-cassetti", 570, 180, 90);
  put(living, "base-60", 570, 240, 90);
  put(living, "lavastoviglie", 571.5, 300, 90);
  put(living, "pensile-80", 582.5, 110, 90);
  put(living, "pensile-60", 582.5, 180, 90);
  put(living, "pensile-60", 582.5, 240, 90);
  // Zona giorno.
  put(living, "tappeto-160", 230, 300, 90);
  put(living, "divano-3p", 230, 378, 180);
  put(living, "tavolino-rett", 230, 280);
  put(living, "poltrona", 110, 110, 270);
  put(living, "tavolo-120", 420, 330);
  put(living, "sedia-legno", 395, 264);
  put(living, "sedia-legno", 445, 264);
  put(living, "sedia-legno", 395, 396, 180);
  put(living, "sedia-legno", 445, 396, 180);
  put(living, "lampada-terra", 60, 400);

  put(bedroom, "letto-160", 275, 635, 90);
  put(bedroom, "comodino", 361, 528, 90);
  put(bedroom, "comodino", 361, 742, 90);
  put(bedroom, "armadio-150", 85, 490);
  put(bedroom, "plafoniera", 190, 635);

  put(bath, "mobile-lavabo-60", 412.5, 545, 270);
  put(bath, "specchio-bagno", 392, 545, 270, 110);
  put(bath, "wc-sospeso", 420, 673.5, 180);
  put(bath, "bidet-sospeso", 470, 673.5, 180);
  put(bath, "piatto-doccia-80", 560, 660, 180);

  put(storage, "lavatrice", 572.5, 760, 90);

  f.rooms.push(living, bedroom, bath, storage);
  return h;
}

function trilocaleDuePiani(): House {
  const h = createHouse("Casa su due piani");
  const ground = h.floors[0];
  const upper = createFloor(1);
  h.floors.push(upper);

  const living = rect("soggiorno", "Soggiorno", 0, 0, 500, 420, [true, false, false, true]);
  const kitchen = rect("cucina", "Cucina", 510, 0, 320, 420, [true, true, false, false]);
  const hall = rect("ingresso", "Ingresso e scala", 0, 430, 300, 260, [false, false, true, true]);
  const wc = rect("bagno", "Bagno di servizio", 310, 430, 190, 260, [false, false, true, false]);
  const laundry = rect("lavanderia", "Lavanderia", 510, 430, 320, 260, [false, true, true, false]);

  opening(living, 0, "window", 100, 180, { height: 230, sill: 0 });
  opening(living, 3, "window", 150, 120);
  opening(living, 1, "passage", 120, 140);
  opening(kitchen, 0, "window", 100, 120, { sill: 105, height: 120 });
  opening(hall, 0, "passage", 100, 110);
  opening(hall, 3, "door", 160, 100, { swing: "in" });
  opening(wc, 0, "door", 60, 70);
  opening(wc, 2, "window", 70, 60, { sill: 120, height: 80 });
  opening(laundry, 0, "door", 40, 80);
  opening(laundry, 1, "window", 100, 80);

  put(living, "divano-angolare", 210, 300, 180);
  put(living, "tappeto-200", 210, 210, 90);
  put(living, "tavolino-tondo", 200, 170);
  put(living, "mobile-tv-160", 220, 21);
  put(living, "libreria-80", 15, 330, 270);
  put(living, "pianta-grande", 460, 50);

  put(kitchen, "colonna-frigo", 540, 30);
  put(kitchen, "colonna-forno", 600, 30);
  put(kitchen, "base-60", 660, 30);
  put(kitchen, "base-lavello-80", 730, 30);
  put(kitchen, "base-60-cassetti", 800, 30);
  put(kitchen, "pensile-60", 660, 17.5);
  put(kitchen, "pensile-scolapiatti", 730, 17.5);
  put(kitchen, "tavolo-tondo", 690, 280);
  put(kitchen, "sedia-imbottita", 690, 205);
  put(kitchen, "sedia-imbottita", 690, 355, 180);

  const stairs = put(hall, "scala-dritta", 150, 645, 90);
  stairs.linkFloorId = upper.id;

  put(wc, "wc-sospeso", 340, 663.5, 180);
  put(wc, "lavabo-sospeso", 470, 560, 90, 70);

  put(laundry, "lavatrice", 545, 662.5, 180);
  put(laundry, "asciugatrice", 610, 658, 180);

  ground.rooms.push(living, kitchen, hall, wc, laundry);

  const master = rect("camera", "Camera matrimoniale", 0, 0, 420, 400, [true, false, false, true]);
  const kid = rect("cameretta", "Cameretta", 430, 0, 400, 400, [true, true, false, false]);
  const landing = rect("corridoio", "Disimpegno", 0, 410, 520, 280, [false, false, true, true]);
  const bath = rect("bagno", "Bagno", 530, 410, 300, 280, [false, true, true, false]);

  opening(master, 0, "window", 150, 140);
  opening(master, 2, "door", 140, 80);
  opening(kid, 0, "window", 140, 120);
  opening(kid, 2, "door", 315, 80);
  opening(bath, 3, "door", 100, 70);
  opening(bath, 2, "window", 50, 100, { sill: 110, height: 110 });

  put(master, "letto-180", 210, 107.5);
  put(master, "comodino", 92, 19);
  put(master, "comodino", 328, 19);
  put(master, "armadio-scorrevole", 33, 200, 270);
  put(kid, "letto-singolo", 781.5, 296);
  put(kid, "scrivania-120", 740, 30);
  put(kid, "sedia-ufficio", 740, 100, 180);
  put(kid, "armadio-150", 459, 150, 270);
  const upperStairs = put(landing, "scala-dritta", 150, 645, 90);
  upperStairs.linkFloorId = ground.id;
  put(bath, "vasca-170", 645, 445);
  put(bath, "mobile-lavabo-80", 680, 667, 180, 35);
  put(bath, "wc-sospeso", 803.5, 530, 90);
  put(bath, "bidet-sospeso", 803.5, 585, 90);

  upper.rooms.push(master, kid, landing, bath);
  return h;
}

function monolocale(): House {
  const h = createHouse("Monolocale 35 m²");
  const f = h.floors[0];
  const open = rect("soggiorno", "Open space", 0, 0, 560, 480, [true, true, false, true]);
  const bath = rect("bagno", "Bagno", 0, 490, 220, 170, [false, false, true, true]);
  const hall = rect("ingresso", "Ingresso", 230, 490, 330, 170, [false, true, true, false]);

  opening(open, 0, "window", 60, 180, { height: 230, sill: 0 });
  opening(open, 1, "window", 160, 120);
  opening(open, 2, "passage", 60, 120);
  opening(bath, 0, "door", 70, 70);
  opening(hall, 2, "door", 120, 90);

  put(open, "divano-letto", 150, 420, 180);
  put(open, "tavolino-rett", 150, 320);
  put(open, "mobile-tv-160", 150, 21);
  put(open, "base-60", 530, 300, 90);
  put(open, "base-lavello-80", 530, 370, 90);
  put(open, "frigo-libera", 527, 233, 90);
  put(open, "pensile-60", 542.5, 300, 90);
  put(open, "tavolo-tondo", 360, 170);
  put(open, "sedia-legno", 360, 99);
  put(open, "sedia-legno", 360, 241, 180);
  put(open, "libreria-160", 17.5, 230, 270);
  put(bath, "piatto-doccia-80", 40, 620, 180);
  put(bath, "wc-sospeso", 110, 633.5, 180);
  put(bath, "lavabo-sospeso", 197.5, 550, 90, 70);
  put(hall, "lavatrice", 532.5, 600, 90);

  f.rooms.push(open, bath, hall);
  return h;
}

export const EXAMPLE_HOUSES: { id: string; build: () => House }[] = [
  { id: "esempio-bilocale", build: bilocale },
  { id: "esempio-due-piani", build: trilocaleDuePiani },
  { id: "esempio-monolocale", build: monolocale },
];
