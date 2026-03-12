/**
 * Recorta una imagen o la primera página de un PDF según la región normalizada [ymin, xmin, ymax, xmax] (0–1000).
 * Mantiene la máxima resolución posible del recorte.
 */
export type Region = [number, number, number, number]; // [ymin, xmin, ymax, xmax]

function getBase64Data(base64: string): string {
  const i = base64.indexOf(",");
  return i >= 0 ? base64.slice(i + 1) : base64;
}

function toDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith("data:")) return base64;
  const data = getBase64Data(base64);
  return `data:${mimeType};base64,${data}`;
}

export function cropImageToRegion(
  base64: string,
  mimeType: string,
  region: Region
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const [ymin, xmin, ymax, xmax] = region;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const left = Math.max(0, Math.floor((xmin / 1000) * w));
      const top = Math.max(0, Math.floor((ymin / 1000) * h));
      const rw = Math.min(w - left, Math.ceil(((xmax - xmin) / 1000) * w));
      const rh = Math.min(h - top, Math.ceil(((ymax - ymin) / 1000) * h));
      if (rw <= 0 || rh <= 0) {
        resolve({ base64, mimeType });
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = rw;
      canvas.height = rh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ base64, mimeType });
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, left, top, rw, rh, 0, 0, rw, rh);
      const dataUrl = canvas.toDataURL("image/png");
      resolve({
        base64: dataUrl,
        mimeType: "image/png",
      });
    };
    img.onerror = () => reject(new Error("No se pudo cargar la imagen para recortar"));
    img.src = toDataUrl(base64, mimeType);
  });
}

/**
 * Renderiza la primera página del PDF y recorta por la región. Escala alta para máxima resolución.
 */
export async function cropPdfToRegion(
  base64: string,
  region: Region
): Promise<{ base64: string; mimeType: string }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${(pdfjs as any).version}/build/pdf.worker.min.mjs`;
  const data = getBase64Data(base64);
  const arrayBuffer = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const scale = 3.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64, mimeType: "application/pdf" };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  await page.render({ canvasContext: ctx, viewport }).promise;
  const [ymin, xmin, ymax, xmax] = region;
  const w = viewport.width;
  const h = viewport.height;
  const left = Math.max(0, Math.floor((xmin / 1000) * w));
  const top = Math.max(0, Math.floor((ymin / 1000) * h));
  const rw = Math.min(w - left, Math.ceil(((xmax - xmin) / 1000) * w));
  const rh = Math.min(h - top, Math.ceil(((ymax - ymin) / 1000) * h));
  if (rw <= 0 || rh <= 0) {
    const full = canvas.toDataURL("image/png");
    return { base64: full, mimeType: "image/png" };
  }
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = rw;
  cropCanvas.height = rh;
  const cropCtx = cropCanvas.getContext("2d");
  if (!cropCtx) {
    const full = canvas.toDataURL("image/png");
    return { base64: full, mimeType: "image/png" };
  }
  cropCtx.imageSmoothingEnabled = true;
  cropCtx.imageSmoothingQuality = "high";
  cropCtx.drawImage(canvas, left, top, rw, rh, 0, 0, rw, rh);
  const dataUrl = cropCanvas.toDataURL("image/png");
  return { base64: dataUrl, mimeType: "image/png" };
}

export async function cropFileToRegion(
  base64: string,
  mimeType: string,
  region: Region
): Promise<{ base64: string; mimeType: string }> {
  if (mimeType === "application/pdf") {
    return cropPdfToRegion(base64, region);
  }
  if (mimeType.startsWith("image/")) {
    return cropImageToRegion(base64, mimeType, region);
  }
  return { base64, mimeType };
}

/** Recorta una imagen por región y devuelve la URL en base64 (para miniaturas). Solo imágenes. */
export async function cropBase64Image(base64: string, region: Region): Promise<string> {
  const mime = base64.startsWith("data:") ? (base64.match(/data:([^;]+)/)?.[1] ?? "image/png") : "image/png";
  const res = await cropImageToRegion(base64, mime, region);
  return res.base64;
}
