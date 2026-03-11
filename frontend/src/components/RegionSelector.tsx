import React, { useState, useRef } from 'react';
import { Crosshair, Trash2 } from 'lucide-react';

interface Props {
  imageUrl: string;
  onRegionSelected: (region: [number, number, number, number] | null) => void;
  initialRegion?: [number, number, number, number] | null;
}

export const RegionSelector: React.FC<Props> = ({ imageUrl, onRegionSelected, initialRegion }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRegion, setCurrentRegion] = useState<[number, number, number, number] | null>(initialRegion ?? null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setIsDrawing(true);
    setCurrentRegion(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
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
    if (isDrawing) {
      setIsDrawing(false);
      onRegionSelected(currentRegion);
    }
  };

  const clearRegion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentRegion(null);
    onRegionSelected(null);
  };

  const getStyle = () => {
    if (!currentRegion || !containerRef.current) return {};
    const [ymin, xmin, ymax, xmax] = currentRegion;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
    };
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="absolute top-2 left-2 z-30 flex gap-2">
        <div className="px-3 py-1.5 bg-zinc-900/90 backdrop-blur text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-xl border border-white/10">
          <Crosshair className="w-3 h-3 text-emerald-400" />
          DIBUJA UN ÁREA PARA ENFOCAR EL ANÁLISIS
        </div>
        {currentRegion && (
          <button onClick={clearRegion} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-xl" title="Eliminar selección">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 bg-zinc-100 rounded-xl overflow-hidden cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img src={imageUrl} alt="Region Selection" className="w-full h-full object-contain pointer-events-none" referrerPolicy="no-referrer" />
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
