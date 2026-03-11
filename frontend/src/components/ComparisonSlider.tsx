import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';

interface Props {
  leftImage: string;
  rightImage: string;
  leftLabel?: string;
  rightLabel?: string;
}

export const ComparisonSlider: React.FC<Props> = ({
  leftImage,
  rightImage,
  leftLabel = "Original",
  rightLabel = "Nueva",
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-3xl overflow-hidden border border-zinc-200 bg-zinc-100 cursor-col-resize select-none"
      onMouseMove={(e) => isDragging && handleMove(e.clientX)}
      onTouchMove={(e) => isDragging && handleMove(e.touches[0].clientX)}
      onMouseDown={() => setIsDragging(true)}
      onTouchStart={() => setIsDragging(true)}
    >
      <img src={rightImage} alt="Right" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
      <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full z-10">{rightLabel}</div>
      <div className="absolute inset-0 w-full h-full overflow-hidden" style={{ width: `${sliderPosition}%` }}>
        <img src={leftImage} alt="Left" className="absolute inset-0 w-full h-full object-contain" style={{ width: `${100 / (sliderPosition / 100)}%` }} draggable={false} />
        <div className="absolute top-4 left-4 px-3 py-1.5 bg-emerald-600/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full z-10">{leftLabel}</div>
      </div>
      <div className="absolute inset-y-0 z-20 w-1 bg-white shadow-[0_0_15px_rgba(0,0,0,0.3)]" style={{ left: `${sliderPosition}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-zinc-100">
          <ArrowLeftRight className="w-4 h-4 text-zinc-600" />
        </div>
      </div>
    </div>
  );
};
