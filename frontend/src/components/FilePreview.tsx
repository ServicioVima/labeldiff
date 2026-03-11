import React, { useRef, useEffect } from 'react';
import type { FileData } from '../types';
import { FileText, Image as ImageIcon } from 'lucide-react';

interface Props {
  file: FileData | null;
  label: string;
  differences?: { box_2d: [number, number, number, number]; label: string }[];
  selectedRegion?: [number, number, number, number] | null;
}

export const FilePreview: React.FC<Props> = ({ file, label, differences, selectedRegion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file || !canvasRef.current) return;
    if (!differences && !selectedRegion) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.src = file.previewUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (selectedRegion) {
        const [ymin, xmin, ymax, xmax] = selectedRegion;
        const left = (xmin / 1000) * img.width;
        const top = (ymin / 1000) * img.height;
        const width = ((xmax - xmin) / 1000) * img.width;
        const height = ((ymax - ymin) / 1000) * img.height;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
        ctx.lineWidth = Math.max(4, img.width / 100);
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(left, top, width, height);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, img.width, top);
        ctx.fillRect(0, top + height, img.width, img.height - (top + height));
        ctx.fillRect(0, top, left, height);
        ctx.fillRect(left + width, top, img.width - (left + width), height);
      }
      if (differences) {
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
  }, [file, differences, selectedRegion]);

  if (!file) {
    return (
      <div className="aspect-square rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <ImageIcon className="w-6 h-6 text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-900">{label}</p>
        <p className="text-xs text-zinc-500 mt-1">Sube un archivo para previsualizar</p>
      </div>
    );
  }
  const canPreview = (file.type.startsWith('image/') || file.type === 'application/pdf') && file.previewUrl;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <span className="text-xs text-zinc-400 truncate max-w-[150px]">{file.name}</span>
      </div>
      <div className="relative aspect-square rounded-2xl border border-zinc-200 bg-white overflow-hidden flex items-center justify-center group">
        {canPreview ? (
          (differences || selectedRegion) ? (
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
          ) : (
            <img src={file.previewUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
          )
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center border border-zinc-100">
              <FileText className="w-8 h-8 text-zinc-300" />
            </div>
            <span className="text-xs font-bold text-zinc-400 uppercase">{file.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
