/** Righe di prodotto da un file o feed di catalogo: XML, JSON o CSV, riconosciuti dal contenuto. */
import Papa from "papaparse";
import { rowsFromXml } from "./feedXml";
import { rowsFromJson } from "./importMapping";

export function rowsFromFeedText(raw: string, fileName = ""): Record<string, unknown>[] {
  const text = raw.replace(/^﻿/, "");
  const lower = fileName.toLowerCase();
  const start = text.trimStart().slice(0, 1);
  if (lower.endsWith(".xml") || start === "<") return rowsFromXml(text);
  if (lower.endsWith(".json") || start === "[" || start === "{") return rowsFromJson(JSON.parse(text));
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (!parsed.data.length) throw new Error("Il file non contiene righe");
  return parsed.data;
}

/** Nomi di tutte le colonne presenti nelle righe. */
export const headersOf = (rows: Record<string, unknown>[]) => Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
