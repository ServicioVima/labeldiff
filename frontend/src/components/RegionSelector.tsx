import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crosshair, Trash2, Maximize2, Minimize2, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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

/** Convierte posición ratón a coordenadas normalizadas 0-1000 usando zoom y scroll.
 * Fórmula: pos_relativa_imagen = (pos_ratón - inicio_vista + scroll) / zoom → normalizar a 0-1000. */
function clientToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  scrollLeft: number,
  scrollTop: number,
  zoom: number
): { normX: number; normY: number } {
  const contentX = clientX - rect.left + scrollLeft;
  const contentY = clientY - rect.top + scrollTop;
  const maxX = rect.width * zoom;
  const maxY = rect.height * zoom;
  const clampedX = Math.max(0, Math.min(contentX, maxX));
  const clampedY = Math.max(0, Math.min(contentY, maxY));
  const normX = Math.round((clampedX / maxX) * 1000);
  const normY = Math.round((clampedY / maxY) * 1000);
  return { normX, normY };
}

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
  const [startNorm, setStartNorm] = useState({ normX: 0, normY: 0 });
  const [currentRegion, setCurrentRegion] = useState<[number, number, number, number] | null>(initialRegion ?? null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);

  const updateImageRect = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    imageRectRef.current = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }, []);

  // Actualizar rect cuando cambia zoom (DOM actualizado)
  useEffect(() => {
    const update = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(updateImageRect);
      });
    };
    update();
  }, [zoom, isFullScreen, updateImageRect]);

  useEffect(() => {
    const t = setTimeout(updateImageRect, 100);
    return () => clearTimeout(t);
  }, [updateImageRect]);

  useEffect(() => {
    const onResize = () => setTimeout(updateImageRect, 100);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateImageRect]);

  const getRectAndScroll = () => {
    if (!containerRef.current) return null;
    const rect = imageRectRef.current ?? containerRef.current.getBoundingClientRect();
    return { rect, scrollLeft: containerRef.current.scrollLeft, scrollTop: containerRef.current.scrollTop };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const data = getRectAndScroll();
    if (!data) return;
    const { rect, scrollLeft, scrollTop } = data;
    const { normX, normY } = clientToNormalized(e.clientX, e.clientY, rect, scrollLeft, scrollTop, zoom);
    setStartNorm({ normX, normY });
    setIsDrawing(true);
    setCurrentRegion(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const data = getRectAndScroll();
    if (!data) return;
    const { rect, scrollLeft, scrollTop } = data;
    const { normX, normY } = clientToNormalized(e.clientX, e.clientY, rect, scrollLeft, scrollTop, zoom);
    const xmin = Math.min(startNorm.normX, normX);
    const xmax = Math.max(startNorm.normX, normX);
    const ymin = Math.min(startNorm.normY, normY);
    const ymax = Math.max(startNorm.normY, normY);
    setCurrentRegion([ymin, xmin, ymax, xmax]);
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

  const getStyle = () => {
    if (!currentRegion) return {};
    const [ymin, xmin, ymax, xmax] = currentRegion;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
    };
  };

  const zoomIn = () => setZoom((z) => Math.min(5, z + 0.5));
  const zoomOut = () => setZoom((z) => Math.max(1, z - 0.5));

  const handleConfirm = () => {
    setZoom(1);
    onConfirmSelection?.();
  };

  const wrapperClass = isFullScreen
    ? 'fixed inset-0 z-[100] bg-zinc-900 flex flex-col'
    : 'relative w-full h-full flex flex-col';

  return (
    <div className={wrapperClass}>
      <div className="absolute top-2 left-2 z-30 flex flex-wrap items-center gap-2">
        <div className="px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-xl border border-white/10">
          <Crosshair className="w-3 h-3 text-emerald-400" />
          DIBUJA UN ÁREA PARA ENFOCAR EL ANÁLISIS
        </div>
        {totalPages != null && totalPages > 1 && onPageChange && (
          <div className="flex items-center gap-0.5 bg-white/90 rounded-lg px-2 py-1 border border-white/20 shadow-lg">
            <button type="button" onClick={(e) => { e.stopPropagation(); onPageChange(Math.max(1, currentPage - 1)); }} disabled={currentPage === 1 || isLoading} className="p-1 text-zinc-600 hover:text-zinc-900 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold text-zinc-700 min-w-[36px] text-center">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 inline" /> : `${currentPage}/${totalPages}`}
            </span>
            <button type="button" onClick={(e) => { e.stopPropagation(); onPageChange(Math.min(totalPages, currentPage + 1)); }} disabled={currentPage === totalPages || isLoading} className="p-1 text-zinc-600 hover:text-zinc-900 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <button type="button" onClick={() => setIsFullScreen(!isFullScreen)} className="p-2 rounded-lg bg-white/90 text-zinc-700 hover:bg-white transition-colors shadow-lg border border-white/20" title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>
          {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-1 rounded-lg bg-white/90 shadow-lg border border-white/20 overflow-hidden">
          <button type="button" onClick={zoomOut} className="p-2 text-zinc-700 hover:bg-zinc-100 transition-colors" title="Alejar">−</button>
          <span className="px-2 text-[10px] font-bold text-zinc-600 min-w-[2.5rem] text-center">{zoom.toFixed(1)}×</span>
          <button type="button" onClick={zoomIn} className="p-2 text-zinc-700 hover:bg-zinc-100 transition-colors" title="Acercar">+</button>
        </div>
        {currentRegion && (
          <button type="button" onClick={clearRegion} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-xl" title="Eliminar selección">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        {onConfirmSelection && (
          <button type="button" onClick={handleConfirm} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all shadow-xl flex items-center gap-2">
            <Check className="w-4 h-4" /> Confirmar Selección
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-auto cursor-crosshair select-none bg-zinc-100 rounded-xl"
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
            src={imageUrl}
            alt="Region Selection"
            className="max-w-full max-h-full w-full h-full object-contain pointer-events-none select-none"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            referrerPolicy="no-referrer"
            draggable={false}
          />
          {currentRegion && (
            <div
              className="absolute border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)] pointer-events-none"
              style={getStyle()}
            >
              <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-t-md whitespace-nowrap">Área de Enfoque</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
