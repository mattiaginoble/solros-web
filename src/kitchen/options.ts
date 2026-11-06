/**
 * Finiture della cucina (dati demo con prezzi indicativi): frontali, maniglie, top.
 * I moduli e gli elettrodomestici sono prodotti del catalogo (vedi demoData).
 */

export interface FrontOption {
  id: string;
  label: string;
  color: string;
  /** Sovrapprezzo per cm di larghezza dell'anta rispetto al frontale base. */
  pricePerCm: number;
}

export interface HandleOption {
  id: string;
  label: string;
  price: number;
  /** Con la gola integrata non servono maniglie: il costo è al metro lineare. */
  perMeter?: boolean;
}

export interface WorktopOption {
  id: string;
  label: string;
  color: string;
  pricePerMeter: number;
  thickness: number;
}

export const FRONTS: FrontOption[] = [
  { id: "bianco-opaco", label: "Bianco opaco", color: "#f4f4f1", pricePerCm: 0 },
  { id: "grigio-seta", label: "Grigio seta", color: "#c9c7c2", pricePerCm: 0.6 },
  { id: "salvia", label: "Verde salvia", color: "#a9b8a0", pricePerCm: 0.9 },
  { id: "blu-notte", label: "Blu notte", color: "#2f3b55", pricePerCm: 1.1 },
  { id: "rovere", label: "Rovere naturale", color: "#c39a6b", pricePerCm: 1.4 },
  { id: "nero-opaco", label: "Nero opaco", color: "#2b2b2b", pricePerCm: 1.2 },
];

export const HANDLES: HandleOption[] = [
  { id: "barra-acciaio", label: "Barra in acciaio", price: 9 },
  { id: "pomolo-ottone", label: "Pomolo in ottone", price: 7 },
  { id: "profilo-nero", label: "Profilo nero", price: 11 },
  { id: "gola", label: "Gola integrata (senza maniglie)", price: 38, perMeter: true },
];

export const WORKTOPS: WorktopOption[] = [
  { id: "laminato-rovere", label: "Laminato effetto rovere", color: "#b98d5d", pricePerMeter: 89, thickness: 4 },
  { id: "laminato-cemento", label: "Laminato effetto cemento", color: "#a8a59f", pricePerMeter: 95, thickness: 4 },
  { id: "legno-massello", label: "Legno massello", color: "#9c6b43", pricePerMeter: 260, thickness: 4 },
  { id: "quarzo-bianco", label: "Quarzo bianco", color: "#ecebe7", pricePerMeter: 420, thickness: 3 },
  { id: "inox", label: "Acciaio inox", color: "#b8bcc0", pricePerMeter: 350, thickness: 3 },
];

export const PLINTH_PRICE_PER_METER = 18;
export const FILLER_PRICE = 25;
export const KITCHEN_PRICE_DATE = "2026-10-15T00:00:00.000Z";

export const FRONT_BY_ID = Object.fromEntries(FRONTS.map((f) => [f.id, f]));
export const HANDLE_BY_ID = Object.fromEntries(HANDLES.map((h) => [h.id, h]));
export const WORKTOP_BY_ID = Object.fromEntries(WORKTOPS.map((w) => [w.id, w]));
