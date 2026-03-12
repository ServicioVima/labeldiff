import React, { useState, useEffect } from 'react';
import { ComparisonSlider } from './ComparisonSlider';
import { cropBase64Image } from '../lib/cropToRegion';

interface Props {
  leftImage: string;
  rightImage: string;
  region1: [number, number, number, number] | null;
  region2: [number, number, number, number] | null;
  name?: string;
}

export const CroppedComparisonSlider: React.FC<Props> = ({
  leftImage,
  rightImage,
  region1,
  region2,
  name,
}) => {
  const [croppedLeft, setCroppedLeft] = useState<string | null>(null);
  const [croppedRight, setCroppedRight] = useState<string | null>(null);

  useEffect(() => {
    const crop = async (src: string, region: [number, number, number, number] | null): Promise<string> => {
      if (!region || !src) return src;
      try {
        const dataUrl = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
        return await cropBase64Image(dataUrl, region);
      } catch {
        return src;
      }
    };

    let cancelled = false;
    (async () => {
      const left = await crop(leftImage, region1);
      if (cancelled) return;
      setCroppedLeft(left);
      const right = await crop(rightImage, region2);
      if (cancelled) return;
      setCroppedRight(right);
    })();
    return () => { cancelled = true; };
  }, [leftImage, rightImage, region1, region2]);

  if (!croppedLeft || !croppedRight) {
    return (
      <div className="w-full aspect-square bg-zinc-100 animate-pulse rounded-3xl flex items-center justify-center">
        <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Preparando comparación...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {name && (
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-emerald-500 rounded-full" />
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{name}</span>
        </div>
      )}
      <ComparisonSlider
        leftImage={croppedLeft}
        rightImage={croppedRight}
        leftLabel="Referencia"
        rightLabel="Nueva"
      />
    </div>
  );
};
