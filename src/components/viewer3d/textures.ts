/** Texture procedurali (canvas) per pavimenti e pareti, con cache per materiale e colore. */
import * as THREE from "three";
import type { MaterialDef } from "@/domain/materials";
import { mix } from "@/components/items/symbols";

const cache = new Map<string, THREE.Texture>();

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Restituisce una texture ripetibile; `repeatMeters` indica quanti metri
 * copre un'unità di texture (gli UV delle superfici sono in metri).
 */
export function materialTexture(def: MaterialDef, color: string): THREE.Texture | null {
  if (def.pattern === "plain") return null;
  const key = `${def.id}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const r = rand(def.id.length * 97 + color.charCodeAt(1));
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  let tileMeters = (def.tileSize ?? 60) / 100;

  if (def.pattern === "wood") {
    // Doghe di larghezza tileSize, lunghezza variabile, con venature.
    const rows = 4;
    tileMeters = ((def.tileSize ?? 20) * rows) / 100;
    const h = size / rows;
    for (let row = 0; row < rows; row++) {
      let x = -r() * size;
      while (x < size) {
        const len = size * (0.45 + r() * 0.5);
        const tone = mix(color, r() > 0.5 ? "#ffffff" : "#000000", r() * 0.12);
        ctx.fillStyle = tone;
        ctx.fillRect(x, row * h, len, h);
        ctx.strokeStyle = mix(color, "#000000", 0.18);
        ctx.globalAlpha = 0.25;
        for (let g = 0; g < 5; g++) {
          const gy = row * h + r() * h;
          ctx.beginPath();
          ctx.moveTo(x, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + (r() - 0.5) * 6, x + len * 0.6, gy + (r() - 0.5) * 6, x + len, gy);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = mix(color, "#000000", 0.35);
        ctx.strokeRect(x + 0.5, row * h + 0.5, len, h);
        x += len;
      }
    }
  } else if (def.pattern === "tiles") {
    const n = 2;
    tileMeters = ((def.tileSize ?? 60) * n) / 100;
    const t = size / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = mix(color, r() > 0.5 ? "#ffffff" : "#000000", r() * 0.05);
        ctx.fillRect(i * t, j * t, t, t);
      }
    ctx.strokeStyle = mix(color, "#7a7a7a", 0.45);
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * t, 0);
      ctx.lineTo(i * t, size);
      ctx.moveTo(0, i * t);
      ctx.lineTo(size, i * t);
      ctx.stroke();
    }
  } else if (def.pattern === "stone") {
    tileMeters = (def.tileSize ?? 80) / 100;
    ctx.globalAlpha = 0.18;
    for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = mix(color, "#555555", 0.5 + r() * 0.3);
      ctx.lineWidth = 0.6 + r() * 1.6;
      ctx.beginPath();
      let x = r() * size;
      let y = r() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (r() - 0.4) * 70;
        y += (r() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    // Cemento e moquette: rumore fine.
    tileMeters = 1.5;
    const img = ctx.getImageData(0, 0, size, size);
    const amp = def.pattern === "carpet" ? 26 : 16;
    for (let i = 0; i < img.data.length; i += 4) {
      const d = (r() - 0.5) * amp;
      img.data[i] += d;
      img.data[i + 1] += d;
      img.data[i + 2] += d;
    }
    ctx.putImageData(img, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / tileMeters, 1 / tileMeters);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
