import React, { useRef, useEffect } from 'react';
import { Download } from 'lucide-react';

export interface AreaDiff {
  box_2d: [number, number, number, number];
  label: string;
}

interface Props {
  imageUrl: string;
  areaName: string;
  differences: AreaDiff[];
  showDownload?: boolean;
}

/** Vista previa de un recorte de área con las diferencias visuales dibujadas (coords 0–1000 sobre la imagen del recorte). Permite descargar. */
export const AreaMarkedPreview: React.FC<Props> = ({
  imageUrl,
  areaName,
  differences,
  showDownload = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!imageUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.imageSmoothingEnabled = true;
      (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0);
      if (differences.length > 0) {
        differences.forEach((diff, index) => {
          const [ymin, xmin, ymax, xmax] = diff.box_2d;
          const left = (xmin / 1000) * img.width;
          const top = (ymin / 1000) * img.height;
          const width = ((xmax - xmin) / 1000) * img.width;
          const height = ((ymax - ymin) / 1000) * img.height;
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = Math.max(3, img.width / 150);
          ctx.strokeRect(left, top, width, height);
          ctx.shadowBlur = 0;
          const text = `${index + 1}. ${diff.label}`;
          const fontSize = Math.max(14, img.width / 45);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          const textWidth = ctx.measureText(text).width;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(left, top - fontSize - 16, textWidth + 16, fontSize + 16);
          ctx.fillStyle = 'white';
          ctx.fillText(text, left + 8, top - 12);
        });
      }
    };
    img.onerror = () => {};
    img.src = imageUrl;
  }, [imageUrl, differences]);

  const handleDownload = () => {
    if (!canvasRef.current || canvasRef.current.width === 0) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `marcas_${areaName.replace(/\s+/g, '_')}_${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider">{areaName}</span>
        {showDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-emerald-600 transition-all shadow-sm"
            title="Descargar imagen con marcas"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="relative aspect-video rounded-xl border border-zinc-200 bg-white overflow-hidden flex items-center justify-center">
        {imageUrl ? (
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-full w-full h-full object-contain"
            style={{ imageRendering: 'auto' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">Sin imagen</div>
        )}
      </div>
      {differences.length > 0 && (
        <p className="text-[10px] text-zinc-500">
          {differences.length} diferencia{differences.length !== 1 ? 's' : ''} marcada{differences.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};
