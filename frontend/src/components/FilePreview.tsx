import React, { useRef, useEffect, useState, useLayoutEffect, useCallback } from 'react';
import type { FileData } from '../types';
import { FileText, Image as ImageIcon, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  file: FileData | null;
  label: string;
  differences?: { box_2d: [number, number, number, number]; label: string; areaName?: string }[];
  selectedRegion?: [number, number, number, number] | null;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  showDownload?: boolean;
}

export const FilePreview: React.FC<Props> = ({
  file,
  label,
  differences,
  selectedRegion,
  currentPage = 1,
  onPageChange,
  isLoading = false,
  showDownload: showDownloadProp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const [zoomReady, setZoomReady] = useState(false);

  const hasZoom = Boolean(selectedRegion && !differences);
  const showCanvas = Boolean(differences);
  const showDownloadButton = showDownloadProp ?? Boolean(differences || selectedRegion);

  const handleDownload = useCallback(() => {
    if (!file?.previewUrl) return;
    if (canvasRef.current && canvasRef.current.width > 0) {
      const url = canvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `preview_${label.replace(/\s+/g, '_')}_${Date.now()}.png`;
      a.click();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      if (selectedRegion) {
        const [ymin, xmin, ymax, xmax] = selectedRegion;
        const left = (xmin / 1000) * img.naturalWidth;
        const top = (ymin / 1000) * img.naturalHeight;
        const width = ((xmax - xmin) / 1000) * img.naturalWidth;
        const height = ((ymax - ymin) / 1000) * img.naturalHeight;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.lineWidth = Math.max(4, img.naturalWidth / 100);
        ctx.setLineDash([10, 5]);
        ctx.strokeRect(left, top, width, height);
      }
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `preview_${label.replace(/\s+/g, '_')}_${Date.now()}.png`;
      a.click();
    };
    img.src = file.previewUrl;
  }, [file, label, selectedRegion, differences]);

  useLayoutEffect(() => {
    if (!hasZoom || !containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {};
      if (width != null && height != null) setContainerSize({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [hasZoom]);

  useEffect(() => {
    if (!file?.previewUrl || !hasZoom) {
      setImageSize(null);
      setZoomReady(false);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      requestAnimationFrame(() => setZoomReady(true));
    };
    img.src = file.previewUrl;
  }, [file?.previewUrl, hasZoom]);

  useEffect(() => {
    if (!file || !canvasRef.current) return;
    if (!differences && !selectedRegion) return;
    if (hasZoom) return;
    if (!showCanvas) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.src = file.previewUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.imageSmoothingEnabled = true;
      (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
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
  }, [file, differences, selectedRegion, hasZoom, showCanvas]);

  const zoomStyle = (): React.CSSProperties => {
    if (!hasZoom || !selectedRegion || !imageSize || !containerSize) return {};
    const [ymin, xmin, ymax, xmax] = selectedRegion;
    const iw = imageSize.w;
    const ih = imageSize.h;
    const cw = containerSize.w;
    const ch = containerSize.h;
    const rw = ((xmax - xmin) / 1000) * iw;
    const rh = ((ymax - ymin) / 1000) * ih;
    const rx = (xmin / 1000) * iw;
    const ry = (ymin / 1000) * ih;
    const scale = Math.max(cw / rw, ch / rh);
    const tx = cw / 2 - scale * (rx + rw / 2);
    const ty = ch / 2 - scale * (ry + rh / 2);
    return {
      width: iw,
      height: ih,
      transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
      transition: zoomReady ? 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
      imageRendering: 'auto',
      willChange: zoomReady ? 'transform' : undefined,
    };
  };

  if (!file) {
    return (
      <div className="aspect-[4/5] rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
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
        <div className="flex items-center gap-2">
          {file.totalPages != null && file.totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg px-1.5 py-0.5 border border-zinc-200">
              <button type="button" onClick={(e) => { e.stopPropagation(); onPageChange(Math.max(1, currentPage - 1)); }} disabled={currentPage === 1 || isLoading} className="p-0.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-bold text-zinc-600 min-w-[32px] text-center">
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin inline text-emerald-600" /> : `${currentPage}/${file.totalPages}`}
              </span>
              <button type="button" onClick={(e) => { e.stopPropagation(); onPageChange(Math.min(file.totalPages!, currentPage + 1)); }} disabled={currentPage === file.totalPages || isLoading} className="p-0.5 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {showDownloadButton && (
            <button type="button" onClick={handleDownload} className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-emerald-600 transition-all shadow-sm" title="Descargar imagen">
              <Download className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs text-zinc-400 truncate max-w-[150px]">{file.name}</span>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative aspect-[4/5] rounded-2xl border border-zinc-200 bg-white overflow-hidden flex items-center justify-center group"
      >
        {canPreview ? (
          hasZoom ? (
            <div className="absolute inset-0" style={{ overflow: 'hidden' }}>
              <img
                src={file.previewUrl}
                alt={file.name}
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  ...zoomStyle(),
                  maxWidth: 'none',
                  objectFit: 'none',
                }}
                className="origin-top-left"
              />
            </div>
          ) : showCanvas ? (
            <canvas ref={canvasRef} className="max-w-full max-h-full object-contain w-full h-full" style={{ imageRendering: 'auto' }} />
          ) : (
            <img
              src={file.previewUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain w-full h-full"
              decoding="async"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              style={{ imageRendering: 'auto' }}
            />
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
