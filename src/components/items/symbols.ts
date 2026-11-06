/**
 * Simboli in pianta degli arredi, come primitive geometriche condivise da
 * miniature SVG e pianta Konva. Coordinate in cm, origine al centro
 * dell'oggetto, larghezza lungo x e profondità lungo y (retro verso -y).
 */
import type { Shape } from "@/domain/schema";

export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; r?: number; fill?: "base" | "light" | "dark" | "none"; dash?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: "base" | "light" | "dark" | "none" }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: "base" | "light" | "dark" | "none" }
  | { t: "line"; pts: number[]; dash?: boolean };

export function itemSymbol(shape: Shape | undefined, w: number, d: number, meta?: Record<string, unknown>): Prim[] {
  const hw = w / 2;
  const hd = d / 2;
  const outline: Prim = { t: "rect", x: -hw, y: -hd, w, h: d, fill: "base" };
  const m = Math.min(w, d);
  switch (shape) {
    case "sofa":
    case "armchair": {
      const back = Math.min(d * 0.25, 22);
      const arm = Math.min(w * 0.12, 18);
      const seats = shape === "armchair" ? 1 : Math.max(2, Math.round((w - arm * 2) / 70));
      const seatW = (w - arm * 2) / seats;
      const prims: Prim[] = [
        { ...outline, r: 6 },
        { t: "rect", x: -hw, y: -hd, w, h: back, r: 5, fill: "dark" },
        { t: "rect", x: -hw, y: -hd, w: arm, h: d, r: 5, fill: "dark" },
        { t: "rect", x: hw - arm, y: -hd, w: arm, h: d, r: 5, fill: "dark" },
      ];
      for (let i = 1; i < seats; i++) prims.push({ t: "line", pts: [-hw + arm + seatW * i, -hd + back, -hw + arm + seatW * i, hd - 4] });
      return prims;
    }
    case "bed": {
      const pillowH = Math.min(28, d * 0.15);
      const pillows = w > 120 ? 2 : 1;
      const pw = (w - 16 - (pillows - 1) * 8) / pillows;
      const prims: Prim[] = [
        { ...outline, r: 4 },
        { t: "rect", x: -hw, y: -hd, w, h: 8, fill: "dark" },
        { t: "line", pts: [-hw, -hd + d * 0.38, hw, -hd + d * 0.38] },
        { t: "line", pts: [-hw + 4, -hd + d * 0.38, hw - 8, hd - 8], dash: true },
      ];
      for (let i = 0; i < pillows; i++) prims.push({ t: "rect", x: -hw + 8 + i * (pw + 8), y: -hd + 12, w: pw, h: pillowH, r: 6, fill: "light" });
      return prims;
    }
    case "table":
    case "desk": {
      if (meta?.round) return [{ t: "ellipse", cx: 0, cy: 0, rx: hw, ry: hd, fill: "base" }];
      return shape === "desk"
        ? [outline, { t: "rect", x: hw - Math.min(45, w * 0.35), y: -hd + 3, w: Math.min(45, w * 0.35) - 3, h: d - 6, fill: "none", dash: true }]
        : [{ ...outline, r: 3 }];
    }
    case "chair":
      return [
        { ...outline, r: 6 },
        { t: "rect", x: -hw, y: -hd, w, h: Math.min(10, d * 0.2), r: 4, fill: "dark" },
      ];
    case "wardrobe": {
      const doors = Math.max(1, Math.round(w / 50));
      const prims: Prim[] = [outline, { t: "line", pts: [-hw, hd - 5, hw, hd - 5] }, { t: "line", pts: [-hw + 6, 0, hw - 6, 0], dash: true }];
      for (let i = 1; i < doors; i++) prims.push({ t: "line", pts: [-hw + (w / doors) * i, hd - 5, -hw + (w / doors) * i, hd] });
      return prims;
    }
    case "cabinet":
    case "tv-unit":
    case "nightstand":
      return [outline, { t: "line", pts: [-hw, hd - 4, hw, hd - 4] }];
    case "shelf": {
      const prims: Prim[] = [outline];
      const n = Math.max(1, Math.round(w / 40));
      for (let i = 1; i < n; i++) prims.push({ t: "line", pts: [-hw + (w / n) * i, -hd, -hw + (w / n) * i, hd] });
      return prims;
    }
    case "fridge":
    case "appliance":
    case "oven":
    case "dishwasher":
      return [outline, { t: "line", pts: [-hw, -hd, hw, hd] }, { t: "line", pts: [hw, -hd, -hw, hd] }];
    case "washer":
      return [outline, { t: "circle", cx: 0, cy: d * 0.05, r: m * 0.33, fill: "light" }];
    case "cooktop": {
      const r = Math.min(w, d) * 0.17;
      return [
        { ...outline, fill: "dark" },
        { t: "circle", cx: -w * 0.22, cy: -d * 0.2, r, fill: "none" },
        { t: "circle", cx: w * 0.22, cy: -d * 0.2, r, fill: "none" },
        { t: "circle", cx: -w * 0.22, cy: d * 0.2, r: r * 0.8, fill: "none" },
        { t: "circle", cx: w * 0.22, cy: d * 0.2, r: r * 0.8, fill: "none" },
      ];
    }
    case "hood":
      return [outline, { t: "rect", x: -hw * 0.6, y: -hd * 0.6, w: w * 0.6, h: d * 0.6, fill: "none", dash: true }];
    case "sink":
      return [outline, { t: "rect", x: -hw + 8, y: -hd + 8, w: Math.max(10, w * 0.55), h: d - 16, r: 6, fill: "light" }];
    case "washbasin":
      return [outline, { t: "ellipse", cx: 0, cy: d * 0.08, rx: hw * 0.62, ry: hd * 0.55, fill: "light" }];
    case "toilet":
      return [
        { t: "rect", x: -hw, y: -hd, w, h: d * 0.28, r: 4, fill: "base" },
        { t: "ellipse", cx: 0, cy: d * 0.12, rx: hw * 0.92, ry: d * 0.36, fill: "light" },
      ];
    case "bidet":
      return [{ t: "ellipse", cx: 0, cy: 0, rx: hw, ry: hd, fill: "light" }, { t: "circle", cx: 0, cy: -d * 0.25, r: 2, fill: "dark" }];
    case "shower":
      return [outline, { t: "line", pts: [-hw, -hd, hw, hd] }, { t: "line", pts: [hw, -hd, -hw, hd] }, { t: "circle", cx: 0, cy: 0, r: 3, fill: "dark" }];
    case "bathtub":
      return [{ ...outline, r: 6 }, { t: "rect", x: -hw + 7, y: -hd + 7, w: w - 14, h: d - 14, r: Math.min(30, d * 0.4), fill: "light" }];
    case "mirror":
      return [{ ...outline, fill: "light" }];
    case "lamp-floor":
    case "lamp-ceiling":
    case "lamp-wall":
      return [
        { t: "circle", cx: 0, cy: 0, r: m / 2, fill: "light" },
        { t: "line", pts: [-m / 2, 0, m / 2, 0] },
        { t: "line", pts: [0, -m / 2, 0, m / 2] },
      ];
    case "rug":
      return [{ ...outline, fill: "light" }, { t: "rect", x: -hw + 6, y: -hd + 6, w: w - 12, h: d - 12, fill: "none", dash: true }];
    case "plant":
      return [
        { t: "circle", cx: 0, cy: 0, r: m * 0.32, fill: "base" },
        { t: "circle", cx: -m * 0.2, cy: -m * 0.15, r: m * 0.22, fill: "light" },
        { t: "circle", cx: m * 0.2, cy: -m * 0.1, r: m * 0.2, fill: "light" },
        { t: "circle", cx: 0, cy: m * 0.2, r: m * 0.2, fill: "light" },
      ];
    case "stairs": {
      if (meta?.stairs === "spiral") {
        const prims: Prim[] = [{ t: "circle", cx: 0, cy: 0, r: m / 2, fill: "base" }, { t: "circle", cx: 0, cy: 0, r: m * 0.08, fill: "dark" }];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          prims.push({ t: "line", pts: [Math.cos(a) * m * 0.08, Math.sin(a) * m * 0.08, Math.cos(a) * m * 0.5, Math.sin(a) * m * 0.5] });
        }
        return prims;
      }
      const steps = Math.max(4, Math.round(d / 25));
      const prims: Prim[] = [outline];
      for (let i = 1; i < steps; i++) prims.push({ t: "line", pts: [-hw, -hd + (d / steps) * i, hw, -hd + (d / steps) * i] });
      prims.push({ t: "line", pts: [0, hd - 10, 0, -hd + 14] }, { t: "line", pts: [-6, -hd + 22, 0, -hd + 12, 6, -hd + 22] });
      return prims;
    }
    default:
      return [outline];
  }
}

/** Tinte per il simbolo a partire dal colore del prodotto. */
export function symbolFills(hex: string | undefined) {
  const base = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#d9d6cf";
  return { base, light: mix(base, "#ffffff", 0.55), dark: mix(base, "#23272b", 0.25) };
}

export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, "0")}`;
}
