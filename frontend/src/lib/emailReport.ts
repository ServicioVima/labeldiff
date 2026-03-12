/**
 * Genera la imagen con marcas de diferencias (mismo dibujo que AreaMarkedPreview) y devuelve base64.
 */
export interface DiffBox {
  box_2d: [number, number, number, number];
  label: string;
}

export function getMarkedImageDataUrl(
  imageUrl: string,
  differences: DiffBox[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.imageSmoothingEnabled = true;
      (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0);
      if (differences.length > 0) {
        differences.forEach((diff, index) => {
          const [ymin, xmin, ymax, xmax] = diff.box_2d;
          const left = (xmin / 1000) * img.width;
          const top = (ymin / 1000) * img.height;
          const width = ((xmax - xmin) / 1000) * img.width;
          const height = ((ymax - ymin) / 1000) * img.height;
          ctx.shadowBlur = 15;
          ctx.shadowColor = "rgba(239, 68, 68, 0.5)";
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = Math.max(3, img.width / 150);
          ctx.strokeRect(left, top, width, height);
          ctx.shadowBlur = 0;
          const text = `${index + 1}. ${diff.label}`;
          const fontSize = Math.max(14, img.width / 45);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const textWidth = ctx.measureText(text).width;
          ctx.fillStyle = "#ef4444";
          ctx.fillRect(left, top - fontSize - 16, textWidth + 16, fontSize + 16);
          ctx.fillStyle = "white";
          ctx.fillText(text, left + 8, top - 12);
        });
      }
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for email"));
    img.src = imageUrl;
  });
}

/** Extrae base64 sin prefijo data:image/... para enviar al backend. */
export function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface EmailAttachment {
  filename: string;
  contentBase64: string;
  contentId: string | null;
}

export interface BuildEmailParams {
  language: "es" | "en";
  result: import("../types").ComparisonResult;
  file1: import("../types").FileData | null;
  file2: import("../types").FileData | null;
  comparisonPairs: import("../types").ComparisonPair[];
  pairThumbnails: Record<string, { thumb1?: string; thumb2?: string }>;
  fullImageBoxToCropBox: (box: [number, number, number, number], region: [number, number, number, number]) => [number, number, number, number];
}

const TEXTS = {
  es: {
    subject: "Resumen de cambios – Comparación de etiquetas (borrador para proveedor)",
    greeting: "Estimado proveedor,",
    intro: "Por medio del presente le remitimos el resumen detallado de las diferencias detectadas entre la versión de referencia y la nueva versión del diseño de etiqueta, con el fin de que pueda revisarlas y, en su caso, implementar las correcciones necesarias.",
    sectionVisual: "Evidencia visual",
    sectionChanges: "Resumen de cambios por categoría",
    sectionArea: "Área",
    refCaption: "Versión de referencia (v1)",
    markedCaption: "Nueva versión con diferencias marcadas (v2)",
    changeAdded: "Añadido",
    changeRemoved: "Eliminado",
    changeModified: "Modificado",
    changeAbsent: "Ausente",
    closing: "Quedamos a la espera de sus comentarios. Atentamente,",
  },
  en: {
    subject: "Summary of changes – Label comparison (draft for supplier)",
    greeting: "Dear Supplier,",
    intro: "Please find below the detailed summary of the differences detected between the reference version and the new version of the label design, for your review and, where applicable, implementation of the required corrections.",
    sectionVisual: "Visual evidence",
    sectionChanges: "Summary of changes by category",
    sectionArea: "Area",
    refCaption: "Reference version (v1)",
    markedCaption: "New version with differences marked (v2)",
    changeAdded: "Added",
    changeRemoved: "Removed",
    changeModified: "Modified",
    changeAbsent: "Absent",
    closing: "We look forward to your feedback. Sincerely,",
  },
};

function changeTypeLabel(type: string, lang: "es" | "en"): string {
  const t = TEXTS[lang];
  switch (type) {
    case "added": return t.changeAdded;
    case "removed": return t.changeRemoved;
    case "modified": return t.changeModified;
    case "absent": return t.changeAbsent;
    default: return type;
  }
}

/** Construye subject, htmlBody y attachments para el correo. */
export async function buildEmailPayload(params: BuildEmailParams): Promise<{
  subject: string;
  htmlBody: string;
  attachments: EmailAttachment[];
}> {
  const { language, result, file1, file2, comparisonPairs, pairThumbnails, fullImageBoxToCropBox } = params;
  const t = TEXTS[language];
  const attachments: EmailAttachment[] = [];
  const byArea = comparisonPairs.length > 0;

  const pushAttachment = (contentBase64: string, filename: string, contentId: string) => {
    const b64 = contentBase64.includes(",") ? contentBase64.split(",")[1]! : contentBase64;
    attachments.push({ filename, contentBase64: b64, contentId });
  };

  const parts: string[] = [];
  parts.push(`<div style="font-family: sans-serif; max-width: 720px; color: #333;">`);
  parts.push(`<p>${escapeHtml(t.greeting)}</p>`);
  parts.push(`<p>${escapeHtml(t.intro)}</p>`);
  parts.push(`<h2 style="margin-top: 1.5em;">${escapeHtml(t.sectionVisual)}</h2>`);

  if (byArea) {
    for (let i = 0; i < comparisonPairs.length; i++) {
      const pair = comparisonPairs[i]!;
      if (!pair.region2 || !pairThumbnails[pair.id]?.thumb1 || !pairThumbnails[pair.id]?.thumb2) continue;
      const areaDiffs = result.visualDifferences.filter((d) => d.areaName === pair.name);
      const differencesInCrop = areaDiffs.map((d) => ({
        box_2d: fullImageBoxToCropBox(d.box_2d, pair.region2!),
        label: d.label,
      }));
      const markedDataUrl = await getMarkedImageDataUrl(pairThumbnails[pair.id].thumb2!, differencesInCrop);
      const refB64 = dataUrlToBase64(pairThumbnails[pair.id].thumb1!);
      const markedB64 = dataUrlToBase64(markedDataUrl);
      const safeName = pair.name.replace(/\W/g, "_").slice(0, 30);
      const refId = `ref_area_${i}_${safeName}`;
      const markedId = `marked_area_${i}_${safeName}`;
      pushAttachment(refB64, `referencia_${safeName}.png`, refId);
      pushAttachment(markedB64, `nueva_version_marcas_${safeName}.png`, markedId);
      parts.push(`<h3 style="margin-top: 1.2em;">${escapeHtml(t.sectionArea)}: ${escapeHtml(pair.name)}</h3>`);
      if (areaDiffs.length > 0) {
        parts.push(`<p><strong>${areaDiffs.length} ${language === "es" ? "diferencia(s) detectada(s):" : "difference(s) detected:"}</strong></p><ul>`);
        areaDiffs.forEach((d) => parts.push(`<li>${escapeHtml(d.label)}</li>`));
        parts.push(`</ul>`);
      }
      parts.push(`<p><strong>${escapeHtml(t.refCaption)}</strong></p><p><img src="cid:${refId}" alt="Ref" style="max-width: 100%; height: auto; border: 1px solid #ddd;" /></p>`);
      parts.push(`<p><strong>${escapeHtml(t.markedCaption)}</strong></p><p><img src="cid:${markedId}" alt="Marked" style="max-width: 100%; height: auto; border: 1px solid #ddd;" /></p>`);
    }
  } else {
    if (file1?.previewUrl && file2?.previewUrl) {
      const refB64 = file1.base64?.includes(",") ? file1.base64.split(",")[1]! : (file1.base64 || "");
      const markedDataUrl = await getMarkedImageDataUrl(file2.previewUrl, result.visualDifferences);
      const markedB64 = dataUrlToBase64(markedDataUrl);
      if (refB64) pushAttachment(refB64, "referencia.png", "ref_full");
      pushAttachment(markedB64, "nueva_version_marcas.png", "marked_full");
      parts.push(`<p><strong>${escapeHtml(t.refCaption)}</strong></p><p><img src="cid:ref_full" alt="Ref" style="max-width: 100%; height: auto; border: 1px solid #ddd;" /></p>`);
      parts.push(`<p><strong>${escapeHtml(t.markedCaption)}</strong></p><p><img src="cid:marked_full" alt="Marked" style="max-width: 100%; height: auto; border: 1px solid #ddd;" /></p>`);
    }
  }

  parts.push(`<h2 style="margin-top: 1.5em;">${escapeHtml(t.sectionChanges)}</h2>`);
  if (result.categorizedChanges && result.categorizedChanges.length > 0) {
    const byAreaName = result.categorizedChanges.reduce((acc, c) => {
      const key = c.areaName ?? "General";
      if (!acc[key]) acc[key] = [];
      acc[key].push(c);
      return acc;
    }, {} as Record<string, typeof result.categorizedChanges>);
    for (const [areaName, changes] of Object.entries(byAreaName)) {
      if (areaName !== "General") parts.push(`<h3>${escapeHtml(areaName)}</h3>`);
      parts.push(`<ul style="list-style: none; padding-left: 0;">`);
      for (const c of changes) {
        const typeLabel = changeTypeLabel(c.type, language);
        parts.push(`<li style="margin-bottom: 0.6em; padding: 0.5em; border-left: 4px solid #999;">`);
        parts.push(`<strong>${escapeHtml(c.field ?? c.label ?? "Change")}</strong> – ${escapeHtml(typeLabel)}<br/>`);
        if (c.description) parts.push(`<span style="color: #555;">${escapeHtml(c.description)}</span><br/>`);
        if (c.type === "modified" && (c.oldValue != null || c.newValue != null)) {
          parts.push(`<span style="text-decoration: line-through;">${escapeHtml(c.oldValue ?? "-")}</span> → <strong>${escapeHtml(c.newValue ?? "-")}</strong>`);
        }
        parts.push(`</li>`);
      }
      parts.push(`</ul>`);
    }
  }
  parts.push(`<p style="margin-top: 2em;">${escapeHtml(t.closing)}</p>`);
  parts.push(`</div>`);

  return {
    subject: t.subject,
    htmlBody: parts.join(""),
    attachments,
  };
}
