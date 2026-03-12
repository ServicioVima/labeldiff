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
  // Vite define inyecta process.env.GEMINI_API_KEY en build; en runtime también puede venir de /api/config
  const fromEnv = typeof process !== "undefined" && (process as any).env?.GEMINI_API_KEY;
  return (fromEnv as string) || "";
}

export async function analyzeDifferences(
  file1: { base64: string; mimeType: string },
  file2: { base64: string; mimeType: string },
  systemPrompt: string,
  region1?: [number, number, number, number],
  region2?: [number, number, number, number],
  pairs?: ComparisonPair[]
): Promise<ComparisonResult> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada. Configure la clave o use el backend para exponerla.");
  const ai = new GoogleGenAI({ apiKey });
  const model = cachedModel;

  const validPairs = pairs?.filter((p) => p.region1 && p.region2) ?? [];
  const usePairs = validPairs.length > 0;

  let parts: any[] = [{ text: systemPrompt }];

  if (usePairs) {
    parts.push({
      text: `ESTÁS COMPARANDO ${validPairs.length} ÁREAS ESPECÍFICAS. Para cada par, la primera imagen es REFERENCIA (v1) y la segunda es NUEVA VERSIÓN (v2).
En "categorizedChanges" incluye "areaName" con el nombre del área cuando aplique.
En "visualDifferences" puedes incluir "areaName" para asociar cada caja a un área.
Coordenadas box_2d en escala 0-1000 referidas a la imagen v2 completa.`,
    });
    for (let i = 0; i < validPairs.length; i++) {
      const pair = validPairs[i];
      const crop1 = await cropFileToRegion(file1.base64, file1.mimeType, pair.region1!);
      const crop2 = await cropFileToRegion(file2.base64, file2.mimeType, pair.region2!);
      parts.push({
        text: `--- ÁREA ${i + 1}: ${pair.name} ---${pair.prompt ? `\nInstrucciones: ${pair.prompt}` : ""}`,
      });
      parts.push({ inlineData: { data: crop1.base64.split(",")[1] ?? crop1.base64, mimeType: crop1.mimeType } });
      parts.push({ inlineData: { data: crop2.base64.split(",")[1] ?? crop2.base64, mimeType: crop2.mimeType } });
    }
    parts.push({
      text: `Genera el reporte: textualDifferences (Markdown), categorizedChanges (con type, label, field opcional, description opcional, areaName opcional), visualDifferences (box_2d, label, areaName opcional).`,
    });
  } else {
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

    parts.push(
      { inlineData: { data: f1.base64.split(",")[1] ?? f1.base64, mimeType: f1.mimeType } },
      { inlineData: { data: f2.base64.split(",")[1] ?? f2.base64, mimeType: f2.mimeType } },
      {
        text: `Compara estos dos archivos. PRIMER archivo = REFERENCIA (v1). SEGUNDO = NUEVA VERSIÓN PARA FÁBRICA (v2).
Identifica diferencias: texto, fechas, ingredientes, alérgenos, códigos, color, posición.${regionInstruction}
textualDifferences: Markdown con ### y listas. visualDifferences: box_2d [ymin,xmin,ymax,xmax] 0-1000 solo en v2, y label. categorizedChanges: type (added|removed|modified|absent) y label.`,
      }
    );
  }

  const response = await ai.models.generateContent({
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

  const parsed = JSON.parse(response.text || "{}");
  if (!Array.isArray(parsed.categorizedChanges)) parsed.categorizedChanges = [];
  return parsed;
}
