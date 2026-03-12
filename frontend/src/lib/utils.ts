import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convierte box_2d [ymin, xmin, ymax, xmax] de coordenadas imagen completa (0–1000) a coordenadas del crop (0–1000). */
export function fullImageBoxToCropBox(
  box: [number, number, number, number],
  region: [number, number, number, number]
): [number, number, number, number] {
  const [y0, x0, y1, x1] = region;
  const [ymin, xmin, ymax, xmax] = box;
  const h = y1 - y0 || 1;
  const w = x1 - x0 || 1;
  const clamp = (v: number) => Math.max(0, Math.min(1000, v));
  return [
    clamp(((ymin - y0) / h) * 1000),
    clamp(((xmin - x0) / w) * 1000),
    clamp(((ymax - y0) / h) * 1000),
    clamp(((xmax - x0) / w) * 1000),
  ];
}
