import React from 'react';
import { motion } from 'motion/react';
import { ArrowDown, Zap, Crosshair } from 'lucide-react';

export const BrandHero: React.FC = () => {
  const scrollToTool = () => {
    const element = document.getElementById('analyzer-tool');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative w-full overflow-hidden bg-[#02040a] text-white font-sans min-h-[50vh] flex flex-col justify-center">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 to-[#02040a]" />
        <motion.div
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="absolute left-0 right-0 h-[2px] bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-10"
        />
      </div>

      <div className="relative z-20 px-8 py-12 md:py-16">
        <div className="max-w-4xl">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-[1px] w-12 bg-emerald-500" />
              <span className="text-emerald-500 font-mono text-xs tracking-[0.3em] uppercase">Vima Etiquetas</span>
            </div>
            <h1 className="text-4xl md:text-6xl leading-tight font-black uppercase tracking-tight">
              Control de calidad
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-white">visual con IA</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-8 space-y-6"
          >
            <p className="text-lg max-w-xl text-zinc-400 leading-relaxed">
              Compara versiones de etiquetas y documentos. Define áreas específicas y obtén reportes por categoría (añadido, eliminado, modificado, ausente).
            </p>
            <button
              onClick={scrollToTool}
              type="button"
              className="group inline-flex items-center gap-3 bg-white text-black px-6 py-3 rounded-2xl font-black text-sm transition-all hover:bg-emerald-500 hover:scale-105 active:scale-95"
            >
              <Crosshair className="w-5 h-5" />
              <span>Iniciar análisis</span>
              <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </motion.div>
        </div>

        <div className="mt-12 flex items-center gap-6 text-zinc-500">
          <span className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Zap className="w-3 h-3" />
            Gemini
          </span>
          <span className="text-xs">Multiárea · PDF · Descarga de evidencias</span>
        </div>
      </div>
    </div>
  );
};
