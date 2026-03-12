import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crosshair, Trash2, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  imageUrl: string;
  onRegionSelected: (region: [number, number, number, number] | null) => void;
  onConfirmSelection?: () => void;
  initialRegion?: [number, number, number, number] | null;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}

type ImageRect = { left: number; top: number; width: number; height: number };

export const RegionSelector: React.FC<Props> = ({
  imageUrl,
  onRegionSelected,
  onConfirmSelection,
  initialRegion,
  totalPages,
  currentPage = 1,
  onPageChange,
  isLoading = false,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRegion, setCurrentRegion] = useState<[number, number, number, number] | null>(initialRegion ?? null);
  const [imageRect, setImageRect] = useState<ImageRect | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentRegion(initialRegion ?? null);
  }, [initialRegion]);

  const updateImageRect = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!imageRef.current || !containerRef.current) return;
        const img = imageRef.current.getBoundingClientRect();
        const container = containerRef.current.getBoundingClientRect();
        const scrollLeft = containerRef.current.scrollLeft;
        const scrollTop = containerRef.current.scrollTop;
        setImageRect({
          left: img.left - container.left + scrollLeft,
          top: img.top - container.top + scrollTop,
          width: img.width,
          height: img.height,
        });
      });
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(updateImageRect, 100);
    return () => clearTimeout(t);
  }, [imageUrl, zoom, isFullScreen, updateImageRect]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => updateImageRect();
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [updateImageRect]);

  useEffect(() => {
    const onResize = () => setTimeout(updateImageRect, 100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateImageRect]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRect || !containerRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const x = e.clientX - container.left + scrollLeft;
    const y = e.clientY - container.top + scrollTop;
    if (x < imageRect.left || x > imageRect.left + imageRect.width ||
        y < imageRect.top || y > imageRect.top + imageRect.height) return;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentRegion(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current || !imageRect) return;
    const container = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const x = Math.max(imageRect.left, Math.min(e.clientX - container.left + scrollLeft, imageRect.left + imageRect.width));
    const y = Math.max(imageRect.top, Math.min(e.clientY - container.top + scrollTop, imageRect.top + imageRect.height));

    const xmin = Math.min(startPos.x, x);
    const xmax = Math.max(startPos.x, x);
    const ymin = Math.min(startPos.y, y);
    const ymax = Math.max(startPos.y, y);

    const normXmin = Math.round(((xmin - imageRect.left) / imageRect.width) * 1000);
    const normXmax = Math.round(((xmax - imageRect.left) / imageRect.width) * 1000);
    const normYmin = Math.round(((ymin - imageRect.top) / imageRect.height) * 1000);
    const normYmax = Math.round(((ymax - imageRect.top) / imageRect.height) * 1000);

    setCurrentRegion([normYmin, normXmin, normYmax, normXmax]);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRegion) {
      setIsDrawing(false);
      const region = currentRegion;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onRegionSelected(region));
      });
    } else if (isDrawing) {
      setIsDrawing(false);
    }
  };

  const clearRegion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentRegion(null);
    onRegionSelected(null);
  };

  const getStyle = (): React.CSSProperties => {
    if (!currentRegion || !imageRect) return { display: 'none' };
    const [ymin, xmin, ymax, xmax] = currentRegion;
    return {
      top: `${imageRect.top + (ymin * imageRect.height) / 1000}px`,
      left: `${imageRect.left + (xmin * imageRect.width) / 1000}px`,
      width: `${((xmax - xmin) * imageRect.width) / 1000}px`,
      height: `${((ymax - ymin) * imageRect.height) / 1000}px`,
    };
  };

  const zoomIn = () => setZoom((z) => Math.min(5, z + 0.5));
  const zoomOut = () => setZoom((z) => Math.max(1, z - 0.5));
  const resetZoom = () => setZoom(1);

  const handleConfirm = () => {
    setZoom(1);
    onConfirmSelection?.();
  };

  return (
    <div className={cn(
      'relative w-full h-full flex flex-col bg-zinc-50 rounded-2xl border border-zinc-200 overflow-hidden transition-all duration-300',
      isFullScreen ? 'fixed inset-0 z-[100] rounded-none border-none bg-zinc-900' : 'relative'
    )}>
      {/* Header Controls - mismo layout que referencia */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center gap-2 shadow-sm uppercase tracking-wider">
            <Crosshair className="w-3 h-3 text-emerald-400" />
            DIBUJA UN ÁREA PARA ENFOCAR EL ANÁLISIS
          </div>

          {totalPages != null && totalPages > 1 && onPageChange && (
            <div className="flex items-center gap-1 bg-zinc-100 rounded-lg px-2 py-1 border border-zinc-200">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPageChange(Math.max(1, currentPage - 1)); }}
                disabled={currentPage === 1 || isLoading}
                className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <div className="flex items-center gap-2 min-w-[40px] justify-center">
                {isLoading ? (
                  <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                ) : (
                  <span className="text-[10px] font-black text-zinc-900">{currentPage} / {totalPages}</span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPageChange(Math.min(totalPages, currentPage + 1)); }}
                disabled={currentPage === totalPages || isLoading}
                className="p-1 text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg px-2 py-1 border border-zinc-200">
            <button type="button" onClick={(e) => { e.stopPropagation(); zoomOut(); }} className="p-1 text-zinc-500 hover:text-zinc-900 transition-colors" title="Alejar">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[9px] font-black text-zinc-500 min-w-[30px] text-center">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); zoomIn(); }} className="p-1 text-zinc-500 hover:text-zinc-900 transition-colors" title="Acercar">
              <ZoomIn className="w-3 h-3" />
            </button>
            {zoom !== 1 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); resetZoom(); }} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors border-l border-zinc-200 ml-1" title="Resetear zoom">
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }}
            className="p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-colors border border-zinc-200"
            title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentRegion && (
            <button
              type="button"
              onClick={clearRegion}
              className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 text-[10px] font-black rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 uppercase tracking-wider"
              title="Eliminar selección"
            >
              <Trash2 className="w-3 h-3" />
              Limpiar Área
            </button>
          )}
          {onConfirmSelection && (
            <button type="button" onClick={handleConfirm} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all flex items-center gap-2">
              <Check className="w-4 h-4" /> Confirmar Selección
            </button>
          )}
          {isFullScreen && <div className="h-6 w-px bg-zinc-200 mx-2" />}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 bg-zinc-100 cursor-crosshair select-none overflow-auto min-h-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            minWidth: '100%',
            minHeight: '100%',
          }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Region Selection"
            className="max-w-full max-h-full pointer-events-none select-none"
            referrerPolicy="no-referrer"
            draggable={false}
            onLoad={updateImageRect}
          />

          <div className="absolute inset-0 bg-black/5 pointer-events-none" />

          {currentRegion && imageRect && (
            <div
              className="absolute border-2 border-emerald-500 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)] pointer-events-none"
              style={getStyle()}
            >
              <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-t-md whitespace-nowrap uppercase tracking-widest">
                Área de Enfoque
              </div>
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
