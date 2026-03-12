import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crosshair, Trash2, Maximize2, Minimize2, Check } from 'lucide-react';

interface Props {
  imageUrl: string;
  onRegionSelected: (region: [number, number, number, number] | null) => void;
  onConfirmSelection?: () => void;
  initialRegion?: [number, number, number, number] | null;
}

export const RegionSelector: React.FC<Props> = ({ imageUrl, onRegionSelected, onConfirmSelection, initialRegion }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
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

  useEffect(() => {
    const t = setTimeout(() => {
      updateImageRect();
    }, 100);
    return () => clearTimeout(t);
  }, [isFullScreen, zoom, updateImageRect]);

  useEffect(() => {
    const onResize = () => {
      setTimeout(updateImageRect, 100);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateImageRect]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setTimeout(() => updateImageRect(), 0);
    const rect = imageRectRef.current ?? containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentRegion(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = imageRectRef.current ?? containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const xmin = Math.min(startPos.x, x);
    const xmax = Math.max(startPos.x, x);
    const ymin = Math.min(startPos.y, y);
    const ymax = Math.max(startPos.y, y);
    const normXmin = Math.round((xmin / rect.width) * 1000);
    const normXmax = Math.round((xmax / rect.width) * 1000);
    const normYmin = Math.round((ymin / rect.height) * 1000);
    const normYmax = Math.round((ymax / rect.height) * 1000);
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

  const getStyle = () => {
    if (!currentRegion || !containerRef.current) return {};
    const rect = imageRectRef.current;
    if (!rect) return {};
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
          <button type="button" onClick={onConfirmSelection} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all shadow-xl flex items-center gap-2">
            <Check className="w-4 h-4" /> Confirmar Selección
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 bg-zinc-100 rounded-xl overflow-hidden cursor-crosshair select-none min-h-0 transition-all duration-500"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}>
          <img src={imageUrl} alt="Region Selection" className="max-w-full max-h-full object-contain pointer-events-none transition-all duration-500" referrerPolicy="no-referrer" />
        </div>
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
        {currentRegion && (
          <div className="absolute border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.3)] pointer-events-none" style={getStyle()}>
            <div className="absolute -top-6 left-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-t-md whitespace-nowrap">Área de Enfoque</div>
          </div>
        )}
      </div>
    </div>
  );
};
