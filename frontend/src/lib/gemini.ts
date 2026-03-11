import { GoogleGenAI, Type } from "@google/genai";
import type { ComparisonResult } from "../types";

let cachedApiKey: string | null = null;
let cachedModel: string = "gemini-2.0-flash";

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
              data: file1.base64.split(",")[1] ?? file1.base64,
              mimeType: file1.mimeType,
            },
          },
          {
            inlineData: {
              data: file2.base64.split(",")[1] ?? file2.base64,
              mimeType: file2.mimeType,
            },
          },
          {
            text: `Compara estos dos archivos. El primero es la referencia. Identifica todas las diferencias (texto, valores numéricos, fechas, ingredientes, alérgenos, códigos, color, posición, elementos faltantes o nuevos).${regionInstruction}

            IMPORTANTE PARA EL CAMPO "textualDifferences":
            - Usa formato Markdown para estructurar el reporte.
            - Usa encabezados (###) para las secciones (ej: ### Cambios Críticos).
            - Usa listas con viñetas (-) para cada punto.
            - Usa negrita (**) para resaltar valores específicos que han cambiado.
            - Asegúrate de incluir saltos de línea dobles entre secciones para facilitar la lectura.
            - Sé específico con los valores (ej: "Cambio de fecha de **04.DIC.2025** a **02.ABR.2025**").

            Devuelve el resultado en formato JSON con dos campos:
            1. "textualDifferences": El reporte estructurado en Markdown.
            2. "visualDifferences": Una lista de objetos con "box_2d" [ymin, xmin, ymax, xmax] (coordenadas normalizadas de 0 a 1000) que indiquen dónde están las diferencias en la PRIMERA imagen (referencia), y un "label" corto descriptivo.`,
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
        },
        required: ["textualDifferences", "visualDifferences"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}
