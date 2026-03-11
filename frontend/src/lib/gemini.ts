import { GoogleGenAI, Type } from "@google/genai";
import type { ComparisonResult } from "../types";
import { cropFileToRegion } from "./cropToRegion";

let cachedApiKey: string | null = null;
let cachedModel: string = "gemini-1.5-flash";

export function setGeminiConfig(apiKey: string | undefined, model?: string) {
  if (apiKey != null) cachedApiKey = apiKey;
  if (model != null) cachedModel = model;
}

function getApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  // Vite define inyecta process.env.GEMINI_API_KEY en build; en runtime también puede venir de /api/config
  const fromEnv = typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY;
  return (fromEnv as string) || "";
}

export async function analyzeDifferences(
  file1: { base64: string; mimeType: string },
  file2: { base64: string; mimeType: string },
  systemPrompt: string,
  region1?: [number, number, number, number],
  region2?: [number, number, number, number]
): Promise<ComparisonResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada. Configure la clave o use el backend para exponerla.");
  const ai = new GoogleGenAI({ apiKey });
  const model = cachedModel;

  let f1 = { base64: file1.base64, mimeType: file1.mimeType };
  let f2 = { base64: file2.base64, mimeType: file2.mimeType };
  if (region1) f1 = await cropFileToRegion(file1.base64, file1.mimeType, region1);
  if (region2) f2 = await cropFileToRegion(file2.base64, file2.mimeType, region2);

  let regionInstruction = "";
  if (region1 && region2) {
    regionInstruction = `\n\nATENCIÓN: Se han definido áreas de enfoque específicas para cada archivo:
    - En el archivo de REFERENCIA (primero), enfócate en: [${region1.join(", ")}].
    - En el archivo NUEVO (segundo), enfócate en: [${region2.join(", ")}].
    Compara el contenido de estas dos áreas específicas entre sí. Ignora el resto de los documentos.`;
  } else if (region1) {
    regionInstruction = `\n\nATENCIÓN: Enfócate EXCLUSIVAMENTE en el área delimitada por las coordenadas [ymin, xmin, ymax, xmax]: [${region1.join(", ")}] en ambos archivos. Ignora cualquier diferencia fuera de este recuadro.`;
  }

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              data: f1.base64.split(",")[1] ?? f1.base64,
              mimeType: f1.mimeType,
            },
          },
          {
            inlineData: {
              data: f2.base64.split(",")[1] ?? f2.base64,
              mimeType: f2.mimeType,
            },
          },
          {
            text: `Compara estos dos archivos con este criterio:
            - El PRIMER archivo es la REFERENCIA (v1).
            - El SEGUNDO archivo es la NUEVA VERSIÓN PARA FÁBRICA (v2).

            Identifica todas las diferencias: texto, valores numéricos, fechas, ingredientes, alérgenos, códigos, color, posición, elementos que faltan o que son nuevos.${regionInstruction}

            IMPORTANTE PARA "textualDifferences":
            - Usa formato Markdown: encabezados (###), listas con viñetas (-), negrita (**) para valores que cambian.
            - Incluye saltos de línea dobles entre secciones. Sé específico (ej: "Cambio de fecha de **04.DIC.2025** a **02.ABR.2025**").

            IMPORTANTE PARA "visualDifferences":
            - Las coordenadas "box_2d" [ymin, xmin, ymax, xmax] deben estar normalizadas de 0 a 1000 y referirse EXCLUSIVAMENTE a la imagen v2 (segunda imagen, NUEVA VERSIÓN PARA FÁBRICA). Marca solo en v2 dónde están las diferencias. Incluye un "label" corto por cada caja.

            IMPORTANTE PARA "categorizedChanges":
            - Clasifica cada hallazgo en exactamente una de estas 4 categorías:
              * "added": Elementos nuevos en v2 que no estaban en v1.
              * "removed": Elementos que estaban en v1 pero han desaparecido en v2.
              * "modified": Datos que existen en ambos pero cuyo valor o contenido ha cambiado.
              * "absent": Elementos obligatorios (sellos legales, alérgenos, etc.) que deberían estar en v2 pero NO se detectan.
            - Devuelve una lista de objetos con "type" (una de las 4 anteriores) y "label" (descripción corta del hallazgo). Si no hay hallazgos en una categoría, no incluyas ítems de esa categoría.`,
          },
        ],
      },
    ],
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
              },
              required: ["type", "label"],
            },
          },
        },
        required: ["textualDifferences", "visualDifferences", "categorizedChanges"],
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}");
  if (!Array.isArray(parsed.categorizedChanges)) parsed.categorizedChanges = [];
  return parsed;
}
