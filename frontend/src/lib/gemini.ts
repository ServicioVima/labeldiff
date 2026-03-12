import { GoogleGenAI, Type } from "@google/genai";
import type { ComparisonResult, ComparisonPair } from "../types";
import { cropFileToRegion, cropBase64Image } from "./cropToRegion";

export { cropBase64Image };

let cachedApiKey: string | null = null;
let cachedModel: string = "gemini-1.5-flash";

export function setGeminiConfig(apiKey: string | undefined, model?: string) {
  if (apiKey != null) cachedApiKey = apiKey;
  if (model != null) cachedModel = model;
}

function getApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  const fromEnv = typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY;
  return (fromEnv as string) || "";
}

/** Extrae datos en bruto y mime real para inlineData. Si base64 es data URL de imagen, usamos ese mime (p. ej. PDF guardado como preview imagen). */
function normalizeInlineData(base64: string, declaredMime: string): { data: string; mimeType: string } {
  if (!base64 || typeof base64 !== "string") {
    throw new Error("Imagen no válida: datos vacíos.");
  }
  const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    const mime = dataUrlMatch[1].trim().toLowerCase();
    const raw = dataUrlMatch[2].trim();
    if (!raw) throw new Error("Imagen no válida: base64 vacío.");
    return { data: raw, mimeType: mime };
  }
  const raw = base64.indexOf(",") >= 0 ? base64.split(",")[1]?.trim() ?? base64 : base64;
  if (!raw) throw new Error("Imagen no válida: base64 vacío.");
  const mimeType = declaredMime.startsWith("image/") ? declaredMime : "image/png";
  return { data: raw, mimeType };
}

/** Obtiene el texto de la respuesta del SDK (distintas versiones pueden exponer .text o candidates[].content.parts[].text). */
function getResponseText(response: any): string {
  if (response?.text && typeof response.text === "string") return response.text;
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts[0]?.text) return parts[0].text;
  return "";
}

/** Parsea JSON de la respuesta; tolera texto envuelto en markdown (```json ... ```). */
function parseResponseJson(raw: string): ComparisonResult {
  let str = (raw || "").trim();
  if (!str) throw new Error("La API no devolvió contenido.");
  const codeBlock = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) str = codeBlock[1].trim();
  try {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object") throw new Error("Respuesta no es un objeto JSON.");
    return {
      textualDifferences: typeof parsed.textualDifferences === "string" ? parsed.textualDifferences : "",
      visualDifferences: Array.isArray(parsed.visualDifferences) ? parsed.visualDifferences : [],
      categorizedChanges: Array.isArray(parsed.categorizedChanges) ? parsed.categorizedChanges : [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unterminated") || msg.includes("position") || msg.includes("truncat")) {
      throw new Error("La respuesta de la IA fue demasiado larga y se cortó. Prueba con menos áreas o vuelve a ejecutar el análisis.");
    }
    throw new Error(`Respuesta de la IA no es JSON válido: ${msg}`);
  }
}

export async function analyzeDifferences(
  file1: { base64: string; mimeType: string },
  file2: { base64: string; mimeType: string },
  systemPrompt: string,
  region1?: [number, number, number, number],
  region2?: [number, number, number, number],
  pairs?: ComparisonPair[]
): Promise<ComparisonResult> {
  if (!file1?.base64?.trim?.()) throw new Error("El archivo de referencia no tiene imagen válida. Vuelve a subirlo.");
  if (!file2?.base64?.trim?.()) throw new Error("El archivo de nueva versión no tiene imagen válida. Vuelve a subirlo.");

  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada. Configure la clave o use el backend para exponerla.");
  const ai = new GoogleGenAI({ apiKey });
  const model = cachedModel;

  const validPairs = pairs?.filter((p) => p.region1 && p.region2) ?? [];
  const usePairs = validPairs.length > 0;

  let parts: any[] = [{ text: systemPrompt }];

  const toInline = (base64: string, mime: string) => {
    const { data, mimeType } = normalizeInlineData(base64, mime);
    return { inlineData: { data, mimeType } };
  };

  if (usePairs) {
    parts.push({
      text: `ESTÁS COMPARANDO ${validPairs.length} ÁREAS. Cada par: primera imagen = REF (v1), segunda = NUEVA (v2).
Incluye "areaName" en categorizedChanges y visualDifferences. box_2d en escala 0-1000 (imagen v2 completa).
Responde CONCISO: evita texto muy largo para no truncar el JSON.`,
    });
    const cropsPerPair = await Promise.all(
      validPairs.map(async (pair) => {
        try {
          const [crop1, crop2] = await Promise.all([
            cropFileToRegion(file1.base64, file1.mimeType, pair.region1!),
            cropFileToRegion(file2.base64, file2.mimeType, pair.region2!),
          ]);
          return { pair, crop1, crop2 };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`Error al recortar el área "${pair.name}": ${msg}`);
        }
      })
    );
    cropsPerPair.forEach(({ pair, crop1, crop2 }, i) => {
      parts.push({
        text: `--- ÁREA ${i + 1}: ${pair.name} ---${pair.prompt ? `\nInstrucciones: ${pair.prompt}` : ""}`,
      });
      parts.push(toInline(crop1.base64, crop1.mimeType));
      parts.push(toInline(crop2.base64, crop2.mimeType));
    });
    parts.push({
      text: `Genera el reporte en JSON. IMPORTANTE: Sé CONCISO para no truncar la respuesta.
- textualDifferences: Markdown breve, máximo 2-3 párrafos por área, solo diferencias relevantes.
- categorizedChanges: lista solo cambios (type, label, field, description, areaName). Máximo ~15 ítems.
- visualDifferences: solo cajas con diferencias (box_2d, label, areaName). Máximo ~20 ítems.
Evita texto repetitivo o explicaciones largas.`,
    });
  } else {
    let f1 = { base64: file1.base64, mimeType: file1.mimeType };
    let f2 = { base64: file2.base64, mimeType: file2.mimeType };
    try {
      if (region1) f1 = await cropFileToRegion(file1.base64, file1.mimeType, region1);
      if (region2) f2 = await cropFileToRegion(file2.base64, file2.mimeType, region2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Error al recortar el área de enfoque: ${msg}`);
    }

    let regionInstruction = "";
    if (region1 && region2) {
      regionInstruction = `\n\nATENCIÓN: Se han definido áreas de enfoque específicas para cada archivo:
    - En el archivo de REFERENCIA (primero), enfócate en: [${region1.join(", ")}].
    - En el archivo NUEVO (segundo), enfócate en: [${region2.join(", ")}].
    Compara el contenido de estas dos áreas específicas entre sí. Ignora el resto de los documentos.`;
    } else if (region1) {
      regionInstruction = `\n\nATENCIÓN: Enfócate EXCLUSIVAMENTE en el área delimitada por las coordenadas [ymin, xmin, ymax, xmax]: [${region1.join(", ")}] en ambos archivos. Ignora cualquier diferencia fuera de este recuadro.`;
    }

    parts.push(
      toInline(f1.base64, f1.mimeType),
      toInline(f2.base64, f2.mimeType),
      {
        text: `Compara estos dos archivos. PRIMER archivo = REFERENCIA (v1). SEGUNDO = NUEVA VERSIÓN PARA FÁBRICA (v2).
Identifica diferencias: texto, fechas, ingredientes, alérgenos, códigos, color, posición.${regionInstruction}
textualDifferences: Markdown con ### y listas. visualDifferences: box_2d [ymin,xmin,ymax,xmax] 0-1000 solo en v2, y label. categorizedChanges: type (added|removed|modified|absent) y label.`,
      }
    );
  }

  let response: any;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            textualDifferences: { type: Type.STRING },
            visualDifferences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                  label: { type: Type.STRING },
                  areaName: { type: Type.STRING },
                },
                required: ["box_2d", "label"],
              },
            },
            categorizedChanges: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ["added", "removed", "modified", "absent"] },
                  label: { type: Type.STRING },
                  field: { type: Type.STRING },
                  oldValue: { type: Type.STRING },
                  newValue: { type: Type.STRING },
                  description: { type: Type.STRING },
                  areaName: { type: Type.STRING },
                },
                required: ["type", "label"],
              },
            },
          },
          required: ["textualDifferences", "visualDifferences", "categorizedChanges"],
        },
      },
    });
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg.includes("API key") || msg.includes("401") || msg.includes("403")) {
      throw new Error("Clave de API de Gemini inválida o sin permiso. Revise GEMINI_API_KEY.");
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
      throw new Error("Límite de uso de la API alcanzado. Espere unos minutos e intente de nuevo.");
    }
    if (msg.includes("blocked") || msg.includes("Safety")) {
      throw new Error("La API bloqueó la respuesta por política de contenido. Pruebe con otras imágenes.");
    }
    throw new Error(`Error de la API Gemini: ${msg}`);
  }

  const rawText = getResponseText(response);
  return parseResponseJson(rawText);
}
