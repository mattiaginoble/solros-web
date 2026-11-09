/**
 * Modello dati del Configuratore Casa.
 *
 * Gerarchia: House → Floor → Room → { walls, openings, items }.
 * Tutte le misure sono in centimetri. Il sistema di coordinate è quello dello
 * schermo: x verso destra, y verso il basso. Ogni stanza ha un poligono in
 * coordinate locali che rappresenta la FACCIA INTERNA dei muri (le misure che
 * l'utente inserisce sono quindi quelle calpestabili); i muri si sviluppano
 * verso l'esterno del poligono con il proprio spessore.
 *
 * Gli schemi zod sono la fonte di verità: validano import JSON e richieste API,
 * e da essi derivano i tipi TypeScript.
 */
import { z } from "zod";

export const Vec2Schema = z.object({ x: z.number(), y: z.number() });
export type Vec2 = z.infer<typeof Vec2Schema>;

export const MountTypeSchema = z.enum(["floor", "wall", "ceiling"]);
export type MountType = z.infer<typeof MountTypeSchema>;

export const ProductSourceSchema = z.enum(["store", "demo", "import", "link", "manual"]);
export type ProductSource = z.infer<typeof ProductSourceSchema>;

/** Forme parametriche disponibili per il 3D quando manca un modello glTF. */
export const ShapeSchema = z.enum([
  "box",
  "sofa",
  "armchair",
  "bed",
  "table",
  "chair",
  "desk",
  "wardrobe",
  "cabinet",
  "shelf",
  "nightstand",
  "tv-unit",
  "appliance",
  "fridge",
  "oven",
  "cooktop",
  "hood",
  "dishwasher",
  "washer",
  "sink",
  "washbasin",
  "toilet",
  "bidet",
  "shower",
  "bathtub",
  "mirror",
  "lamp-floor",
  "lamp-ceiling",
  "lamp-wall",
  "rug",
  "plant",
  "stairs",
  "worktop",
]);
export type Shape = z.infer<typeof ShapeSchema>;

/** Vero per URL assoluti http o https. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Link esterno facoltativo, solo http(s). Altri valori (javascript:, data:,
 * testo libero) vengono scartati senza invalidare il documento, così i
 * progetti già salvati continuano ad aprirsi.
 */
const LinkSchema = z.string().refine(isHttpUrl).optional().catch(undefined);

export const ProductSchema = z.object({
  id: z.string(),
  source: ProductSourceSchema.default("manual"),
  retailer: z.string().default("Generico"),
  code: z.string().optional(),
  name: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  price: z.number().min(0),
  currency: z.string().default("EUR"),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  imageUrl: LinkSchema,
  url: LinkSchema,
  mount: MountTypeSchema.default("floor"),
  /** Altezza da terra predefinita per oggetti a parete o a soffitto. */
  elevation: z.number().optional(),
  clearance: z
    .object({ front: z.number().min(0), sides: z.number().min(0) })
    .default({ front: 0, sides: 0 }),
  modelUrl: LinkSchema,
  shape: ShapeSchema.optional(),
  /** Metadati liberi (es. compatibilità dei moduli cucina). */
  meta: z.record(z.string(), z.unknown()).optional(),
  priceUpdatedAt: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

export const WallSchema = z.object({
  id: z.string(),
  thickness: z.number().positive(),
});
export type Wall = z.infer<typeof WallSchema>;

export const OpeningKindSchema = z.enum(["door", "window", "passage"]);
export type OpeningKind = z.infer<typeof OpeningKindSchema>;

export const OpeningSchema = z.object({
  id: z.string(),
  kind: OpeningKindSchema,
  /** Muro (lato del poligono) su cui si trova l'apertura. */
  wallId: z.string(),
  /** Distanza in cm dal vertice iniziale del lato al bordo dell'apertura. */
  offset: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Altezza da terra (davanzale per le finestre, 0 per le porte). */
  sill: z.number().min(0),
  /** Lato della cerniera rispetto al verso del muro. */
  hinge: z.enum(["start", "end"]).default("start"),
  /** Verso di apertura: dentro la stanza o verso l'esterno. */
  swing: z.enum(["in", "out"]).default("in"),
});
export type Opening = z.infer<typeof OpeningSchema>;

export const PlacedItemSchema = z.object({
  id: z.string(),
  /** Copia del prodotto: il progetto resta autosufficiente anche offline. */
  product: ProductSchema,
  /** Centro dell'oggetto in coordinate locali della stanza (cm). */
  x: z.number(),
  y: z.number(),
  /** Rotazione in gradi, senso orario. */
  rotation: z.number(),
  /** Altezza da terra della base dell'oggetto (cm). */
  elevation: z.number().min(0).default(0),
  quantity: z.number().int().positive().default(1),
  /** Collegamento a un altro piano (per le scale). */
  linkFloorId: z.string().optional(),
  /** Oggetto generato dal configuratore cucina. */
  kitchen: z
    .object({ runId: z.string(), slot: z.number().int(), role: z.string() })
    .optional(),
});
export type PlacedItem = z.infer<typeof PlacedItemSchema>;

export const MaterialSchema = z.object({
  /** Identificativo del materiale (vedi src/domain/materials.ts). */
  id: z.string(),
  color: z.string(),
});
export type Material = z.infer<typeof MaterialSchema>;

export const RoomTypeSchema = z.enum([
  "soggiorno",
  "cucina",
  "sala_pranzo",
  "camera",
  "cameretta",
  "bagno",
  "studio",
  "ingresso",
  "corridoio",
  "ripostiglio",
  "lavanderia",
  "balcone",
  "garage",
  "altro",
]);
export type RoomType = z.infer<typeof RoomTypeSchema>;

export const KitchenModuleSchema = z.object({
  id: z.string(),
  /** base | wall | tall | appliance-slot | filler | corner */
  kind: z.string(),
  width: z.number().positive(),
  /** Elettrodomestico incassato (id prodotto del catalogo), se presente. */
  applianceId: z.string().optional(),
  /** Variante del modulo (cassetti, ante, lavello, ...). */
  variant: z.string().optional(),
});
export type KitchenModule = z.infer<typeof KitchenModuleSchema>;

export const KitchenRunSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  /** Inizio della composizione lungo il muro (cm dal vertice iniziale). */
  start: z.number(),
  length: z.number().positive(),
  base: z.array(KitchenModuleSchema),
  wall: z.array(KitchenModuleSchema),
});
export type KitchenRun = z.infer<typeof KitchenRunSchema>;

export const KitchenConfigSchema = z.object({
  layout: z.enum(["linear", "corner"]),
  runs: z.array(KitchenRunSchema),
  frontId: z.string(),
  handleId: z.string(),
  worktopId: z.string(),
  baseHeight: z.number().default(90),
  wallElevation: z.number().default(145),
  appliances: z.record(z.string(), z.string()).default({}),
});
export type KitchenConfig = z.infer<typeof KitchenConfigSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: RoomTypeSchema,
  color: z.string(),
  /** Posizione dell'origine locale nel piano (cm). */
  x: z.number(),
  y: z.number(),
  /** Rotazione della stanza in gradi (senso orario) attorno all'origine locale. */
  rotation: z.number(),
  /** Faccia interna dei muri, in coordinate locali, con area con segno positiva. */
  polygon: z.array(Vec2Schema).min(3),
  /** walls[i] corrisponde al lato polygon[i] → polygon[i+1]. */
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  items: z.array(PlacedItemSchema),
  ceilingHeight: z.number().positive(),
  floorMaterial: MaterialSchema,
  wallMaterial: MaterialSchema,
  kitchen: KitchenConfigSchema.optional(),
});
export type Room = z.infer<typeof RoomSchema>;

export const FloorplanBackgroundSchema = z.object({
  /** Immagine rasterizzata (data URL). */
  src: z.string(),
  /** Dimensioni dell'immagine in pixel. */
  pixelWidth: z.number().positive(),
  pixelHeight: z.number().positive(),
  /** Posizione dell'angolo in alto a sinistra nel piano (cm). */
  x: z.number(),
  y: z.number(),
  /** Scala: centimetri per pixel. */
  cmPerPixel: z.number().positive(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  calibrated: z.boolean(),
  locked: z.boolean().default(true),
});
export type FloorplanBackground = z.infer<typeof FloorplanBackgroundSchema>;

export const FloorSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Livello: 0 = piano terra, 1 = primo piano, -1 = seminterrato. */
  level: z.number().int(),
  /** Quota del pavimento rispetto al piano terra (cm). */
  elevation: z.number(),
  /** Spessore del solaio sopra il piano (cm). */
  slabThickness: z.number().min(0).default(30),
  rooms: z.array(RoomSchema),
  background: FloorplanBackgroundSchema.nullable().optional(),
});
export type Floor = z.infer<typeof FloorSchema>;

export const HouseSettingsSchema = z.object({
  gridSize: z.number().positive().default(10),
  defaultWallThickness: z.number().positive().default(10),
  defaultCeilingHeight: z.number().positive().default(270),
  currency: z.string().default("EUR"),
});
export type HouseSettings = z.infer<typeof HouseSettingsSchema>;

export const HouseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  floors: z.array(FloorSchema).min(1),
  settings: HouseSettingsSchema,
});
export type House = z.infer<typeof HouseSchema>;

/** Valida un documento casa sconosciuto (import JSON, API). */
export function parseHouse(input: unknown): House {
  return HouseSchema.parse(input);
}

export function safeParseHouse(input: unknown) {
  return HouseSchema.safeParse(input);
}
