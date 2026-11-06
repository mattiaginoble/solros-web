import "server-only";
/**
 * Analizzatore di planimetrie basato su Claude vision (Anthropic API).
 * Attivo quando FLOORPLAN_ANALYZER=claude e sono disponibili credenziali
 * Anthropic (ANTHROPIC_API_KEY o equivalenti). Restituisce una bozza in pixel
 * dell'immagine inviata, validata con zod.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { RoomTypeSchema } from "@/domain/schema";
import type { FloorplanAnalysis } from "./types";

const DEFAULT_MODEL = "claude-opus-5-5";

export function claudeAnalyzerEnabled() {
  return process.env.FLOORPLAN_ANALYZER === "claude" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const Point = z.object({ x: z.number(), y: z.number() });
const ResultSchema = z.object({
  wall_thickness_px: z.number(),
  scale_cm_per_px: z.number().nullable(),
  rooms: z.array(z.object({ name: z.string(), type: RoomTypeSchema, polygon: z.array(Point).min(3) })),
  openings: z.array(z.object({ kind: z.enum(["door", "window", "passage"]), a: Point, b: Point })),
  notes: z.array(z.string()),
});

const point = {
  type: "object",
  properties: { x: { type: "number" }, y: { type: "number" } },
  required: ["x", "y"],
  additionalProperties: false,
};

/** Schema JSON per gli output strutturati (stessa forma di ResultSchema). */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    wall_thickness_px: { type: "number" },
    scale_cm_per_px: { anyOf: [{ type: "number" }, { type: "null" }] },
    rooms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: RoomTypeSchema.options },
          polygon: { type: "array", items: point },
        },
        required: ["name", "type", "polygon"],
        additionalProperties: false,
      },
    },
    openings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["door", "window", "passage"] },
          a: point,
          b: point,
        },
        required: ["kind", "a", "b"],
        additionalProperties: false,
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["wall_thickness_px", "scale_cm_per_px", "rooms", "openings", "notes"],
  additionalProperties: false,
};

const SYSTEM = `You convert architectural floor plan images into structured geometry for a home planning app.
Coordinates are pixels of the provided image: origin at the top-left corner, x to the right, y downwards.
For every enclosed room return the polygon of the INNER face of its walls (the walkable floor area), with vertices in order. Most walls are horizontal or vertical: keep those edges exactly axis-aligned.
Return each door, window or open passage as the two end points of its gap, measured along the wall centre line.
Use the room labels written on the plan for name and type when present (Italian labels are common: soggiorno, cucina, camera, bagno, ...); otherwise pick the most plausible type and an Italian name.
If dimension annotations are readable, estimate scale_cm_per_px from them, otherwise return null.
Do not invent rooms that are not drawn. Put any uncertainty in notes, in Italian.`;

export async function analyzeWithClaude(image: { base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number }): Promise<FloorplanAnalysis> {
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    // In caso di rifiuto dei classificatori, la richiesta viene ripetuta sul modello di riserva consigliato.
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          {
            type: "text",
            text: `The image is ${image.width} × ${image.height} pixels. Extract rooms and openings.`,
          },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") {
    throw new Error("L'analisi è stata rifiutata dal modello: usa il riconoscimento locale o ricalca a mano.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("La risposta è stata troncata: la planimetria è troppo complessa per l'analisi automatica.");
  }
  const text = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = ResultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("Risposta del modello non valida");
  const r = parsed.data;
  return {
    analyzer: "claude",
    wallThicknessPx: r.wall_thickness_px,
    cmPerPixel: r.scale_cm_per_px ?? undefined,
    rooms: r.rooms.map((room) => ({ name: room.name, type: room.type, polygon: room.polygon })),
    openings: r.openings,
    notes: r.notes,
  };
}
