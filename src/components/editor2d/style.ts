/** Stile grafico della pianta (convenzioni del disegno architettonico). */
export const PLAN = {
  paper: "#f3f6f4",
  gridMinor: "#dbe8e1",
  gridMajor: "#b4cfc2",
  wall: "#2b3035",
  wallShared: "#2b3035",
  wallSelected: "#1d4f91",
  ink: "#23272b",
  inkSoft: "#4a5258",
  muted: "#66716c",
  accent: "#1d4f91",
  accentTint: "rgba(29,79,145,0.12)",
  dimension: "#1d4f91",
  danger: "#b42318",
  dangerTint: "rgba(180,35,24,0.18)",
  warning: "#9a5b00",
  openingFill: "#f3f6f4",
  white: "#ffffff",
};

let narrow: string | null = null;
let regular: string | null = null;

/** Famiglie tipografiche caricate da next/font (lette dalle variabili CSS). */
export function planFonts() {
  if (typeof window === "undefined") return { narrow: "sans-serif", regular: "sans-serif" };
  if (!narrow || !regular) {
    const cs = getComputedStyle(document.documentElement);
    narrow = cs.getPropertyValue("--font-archivo-narrow").trim() || "Arial Narrow, sans-serif";
    regular = cs.getPropertyValue("--font-archivo").trim() || "Arial, sans-serif";
  }
  return { narrow, regular };
}

/**
 * Testo leggibile: angolo riportato in [-90, 90). Le quote verticali si leggono
 * dal basso verso l'alto, come nei disegni architettonici.
 */
export function uprightAngle(deg: number) {
  let a = ((deg % 360) + 360) % 360;
  if (a >= 90 && a < 270) a -= 180;
  else if (a >= 270) a -= 360;
  return a;
}

export function formatCm(n: number) {
  const r = Math.round(n * 10) / 10;
  return r.toLocaleString("it-IT", { maximumFractionDigits: 1, useGrouping: false });
}

export function formatM2(n: number) {
  return `${n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
}
