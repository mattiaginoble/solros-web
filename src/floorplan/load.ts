"use client";
/** Caricamento di planimetrie PNG, JPG o PDF (prima pagina) come immagine raster. */

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  fileName: string;
}

const MAX_SIDE = 2400;

function canvasToResult(canvas: HTMLCanvasElement, fileName: string): LoadedImage {
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), width: canvas.width, height: canvas.height, fileName };
}

function fitCanvas(w: number, h: number, maxSide = MAX_SIDE) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx, k };
}

async function loadRaster(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  const { canvas, ctx } = fitCanvas(bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToResult(canvas, file.name);
}

async function loadPdf(file: File): Promise<LoadedImage> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, MAX_SIDE / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const { canvas } = fitCanvas(viewport.width, viewport.height, Infinity);
    await page.render({ canvas, viewport }).promise;
    return canvasToResult(canvas, file.name);
  } finally {
    await doc.destroy();
  }
}

export async function loadFloorplanFile(file: File): Promise<LoadedImage> {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (isPdf) return loadPdf(file);
  if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) throw new Error("Formato non supportato: usa PNG, JPG o PDF.");
  return loadRaster(file);
}

/** Pixel RGBA di un'immagine ridotta (lato massimo `maxSide`) e fattore di riduzione. */
export async function imagePixels(dataUrl: string, maxSide: number) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const { canvas, ctx, k } = fitCanvas(img.naturalWidth, img.naturalHeight, maxSide);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: data.data, width: canvas.width, height: canvas.height, scale: k, canvas };
}
