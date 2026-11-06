/** Materiali semplici per pavimenti e pareti, usati in 2D (colore) e 3D (texture procedurale). */
export interface MaterialDef {
  id: string;
  label: string;
  color: string;
  /** Tipo di texture procedurale generata nel 3D. */
  pattern: "plain" | "wood" | "tiles" | "stone" | "concrete" | "carpet";
  /** Dimensione della piastrella/doga in cm, per il pattern. */
  tileSize?: number;
}

export const FLOOR_MATERIALS: MaterialDef[] = [
  { id: "parquet-rovere", label: "Parquet rovere", color: "#c79a63", pattern: "wood", tileSize: 20 },
  { id: "parquet-noce", label: "Parquet noce", color: "#8a5a3b", pattern: "wood", tileSize: 20 },
  { id: "laminato-grigio", label: "Laminato grigio", color: "#a8a39b", pattern: "wood", tileSize: 20 },
  { id: "gres-chiaro", label: "Gres chiaro 60×60", color: "#e4e0d8", pattern: "tiles", tileSize: 60 },
  { id: "gres-scuro", label: "Gres antracite 60×60", color: "#5d5e60", pattern: "tiles", tileSize: 60 },
  { id: "ceramica-bianca", label: "Ceramica bianca 30×30", color: "#f2f2ef", pattern: "tiles", tileSize: 30 },
  { id: "marmo", label: "Marmo", color: "#ece9e4", pattern: "stone", tileSize: 80 },
  { id: "cemento", label: "Resina/cemento", color: "#b9b7b2", pattern: "concrete" },
  { id: "moquette", label: "Moquette", color: "#9aa5b1", pattern: "carpet" },
];

export const WALL_MATERIALS: MaterialDef[] = [
  { id: "pittura-bianca", label: "Pittura bianca", color: "#f5f4f0", pattern: "plain" },
  { id: "pittura-avorio", label: "Avorio", color: "#efe7d6", pattern: "plain" },
  { id: "pittura-grigio", label: "Grigio perla", color: "#d9d9d6", pattern: "plain" },
  { id: "pittura-salvia", label: "Verde salvia", color: "#c7d3bf", pattern: "plain" },
  { id: "pittura-azzurro", label: "Azzurro polvere", color: "#c9d8e3", pattern: "plain" },
  { id: "pittura-terracotta", label: "Terracotta", color: "#d8a58a", pattern: "plain" },
  { id: "piastrelle-bianche", label: "Piastrelle bianche 20×20", color: "#f4f4f2", pattern: "tiles", tileSize: 20 },
  { id: "mattoni", label: "Mattoni a vista", color: "#b4654a", pattern: "tiles", tileSize: 25 },
];

export const FLOOR_MATERIAL_BY_ID = Object.fromEntries(FLOOR_MATERIALS.map((m) => [m.id, m]));
export const WALL_MATERIAL_BY_ID = Object.fromEntries(WALL_MATERIALS.map((m) => [m.id, m]));

export function defaultFloorMaterialFor(roomType: string) {
  if (roomType === "bagno" || roomType === "lavanderia") return FLOOR_MATERIAL_BY_ID["ceramica-bianca"];
  if (roomType === "cucina") return FLOOR_MATERIAL_BY_ID["gres-chiaro"];
  if (roomType === "balcone" || roomType === "garage") return FLOOR_MATERIAL_BY_ID["cemento"];
  return FLOOR_MATERIAL_BY_ID["parquet-rovere"];
}

export function defaultWallMaterialFor(roomType: string) {
  if (roomType === "bagno") return WALL_MATERIAL_BY_ID["piastrelle-bianche"];
  return WALL_MATERIAL_BY_ID["pittura-bianca"];
}
