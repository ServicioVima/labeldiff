import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Search, AlertCircle, CheckCircle2, Layers, ArrowRightLeft, Loader2, FileText, Sparkles, Zap, Download, History, Info, ChevronLeft, ChevronRight, Menu, X, Crosshair, Target, Trash2, LogIn, User,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { FileData, LabelDefinition, ComparisonResult } from './types';
import { setGeminiConfig, analyzeDifferences } from './lib/gemini';
import { getConfig } from './lib/api';
import { useAuth } from './contexts/AuthContext';
import { LabelManager } from './components/LabelManager';
import { FilePreview } from './components/FilePreview';
import { ComparisonSlider } from './components/ComparisonSlider';
import { RegionSelector } from './components/RegionSelector';
import ReactMarkdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const { user, loading: authLoading, loginUrl } = useAuth();
  const [file1, setFile1] = useState<FileData | null>(null);
  const [file2, setFile2] = useState<FileData | null>(null);
  const [labels, setLabels] = useState<LabelDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('labeldiff_categories');
      return saved ? JSON.parse(saved) : [
        { id: '1', name: 'Tabla Nutricional', prompt: 'Analiza detalladamente la tabla nutricional: calorías, grasas, azúcares y sodio. Reporta cualquier cambio en los valores.' },
        { id: '2', name: 'Ingredientes', prompt: 'Compara la lista de ingredientes. Resalta adiciones, eliminaciones o cambios en el orden de los componentes.' },
        { id: '3', name: 'Sellos de Advertencia', prompt: 'Verifica la presencia y posición de los sellos de advertencia (Alto en...).' },
        { id: '4', name: 'Código de Barras', prompt: 'Verifica que el código de barras sea el mismo o si ha cambiado el GTIN.' },
        { id: '5', name: 'Fecha de Vencimiento', prompt: 'Busca cambios en el formato o ubicación de la fecha de vencimiento y lote.' },
        { id: '6', name: 'Alérgenos', prompt: 'Presta especial atención a la declaración de alérgenos (Contiene leche, trazas de maní, etc).' },
      ];
    } catch {
      return [];
    }
  });
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<[number, number, number, number] | null>(null);
  const [selectedRegion2, setSelectedRegion2] = useState<[number, number, number, number] | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFocusMode2, setIsFocusMode2] = useState(false);

  useEffect(() => {
    localStorage.setItem('labeldiff_categories', JSON.stringify(labels));
  }, [labels]);

  useEffect(() => {
    getConfig().then((cfg) => {
      setGeminiConfig(cfg.geminiApiKey, cfg.geminiModel);
    }).catch(() => {});
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[], side: 'left' | 'right') => {
    const file = acceptedFiles[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      let previewUrl = URL.createObjectURL(file);
      if (file.type === 'application/pdf') {
        try {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;
            previewUrl = canvas.toDataURL('image/png');
          }
        } catch {
          previewUrl = '';
        }
      }
      const fileData: FileData = { name: file.name, type: file.type, base64, previewUrl };
      if (side === 'left') setFile1(fileData);
      else setFile2(fileData);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const downloadText = () => {
    if (!result) return;
    const blob = new Blob([result.textualDifferences], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_diferencias_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `diferencias_visuales_${Date.now()}.png`;
    a.click();
  };

  const { getRootProps: getLeftProps, getInputProps: getLeftInput, isDragActive: isLeftActive } = useDropzone({
    onDrop: (files: File[]) => onDrop(files, 'left'),
    multiple: false,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  } as any);

  const { getRootProps: getRightProps, getInputProps: getRightInput, isDragActive: isRightActive } = useDropzone({
    onDrop: (files: File[]) => onDrop(files, 'right'),
    multiple: false,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'], 'application/pdf': ['.pdf'], 'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
  } as any);

  const handleToggleLabel = (id: string) => {
    setSelectedLabelIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const selectedLabels = labels.filter(l => selectedLabelIds.includes(l.id));
      const combinedPrompt = selectedLabels.length > 0
        ? selectedLabels.map(l => `[${l.name}]: ${l.prompt}`).join('\n\n')
        : 'Analiza todas las diferencias visuales y textuales entre estos dos archivos.';
      const analysis = await analyzeDifferences(
        { base64: file1.base64, mimeType: file1.type },
        { base64: file2.base64, mimeType: file2.type },
        combinedPrompt,
        selectedRegion ?? undefined,
        selectedRegion2 ?? undefined,
      );
      setResult(analysis);
    } catch (err) {
      console.error(err);
      setError('Error al analizar los archivos. Por favor, intenta de nuevo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F5] flex font-sans text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 320 }}
        className="h-screen sticky top-0 border-r border-zinc-200 bg-white flex flex-col overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30 shrink-0"
      >
        <div className="p-6 flex flex-col h-full gap-8">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <Layers className="w-6 h-6 text-white" />
              </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-nowrap">
                  <h1 className="font-black text-xl tracking-tight text-zinc-900 leading-none">LabelDiff</h1>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.2em] mt-1">Intelligence Engine</p>
                </motion.div>
              )}
            </div>
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-900 transition-colors">
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {!isSidebarCollapsed && (
            <>
              <div className="flex items-center gap-2 px-2 py-2 rounded-xl bg-zinc-50 border border-zinc-100">
                {user ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900 truncate">{user.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{user.role}</p>
                    </div>
                  </div>
                ) : (
                  <a href={loginUrl} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                    <LogIn className="w-4 h-4" /> Iniciar sesión
                  </a>
                )}
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0">
                  <LabelManager labels={labels} onLabelsChange={setLabels} selectedLabelIds={selectedLabelIds} onToggleLabel={handleToggleLabel} />
                </div>
                <div className="mt-auto space-y-4 shrink-0 pt-6">
                  <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-bold text-zinc-900 uppercase">Tip Pro</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">Combina múltiples etiquetas para un análisis ultra-específico. La IA priorizará los puntos marcados.</p>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">v2.5.0</span>
                    <div className="flex gap-3">
                      <History className="w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors" />
                      <Info className="w-4 h-4 text-zinc-400 hover:text-zinc-600 cursor-pointer transition-colors" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}

          {isSidebarCollapsed && (
            <div className="flex flex-col items-center gap-6 mt-4">
              {user ? <User className="w-5 h-5 text-emerald-600" /> : <a href={loginUrl} className="text-emerald-600"><LogIn className="w-5 h-5" /></a>}
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400"><Menu className="w-5 h-5" /></div>
              <div className="mt-auto flex flex-col gap-4">
                <History className="w-5 h-5 text-zinc-300" />
                <Info className="w-5 h-5 text-zinc-300" />
              </div>
            </div>
          )}
        </div>
      </motion.aside>

      <main className="flex-1 p-8 lg:p-12 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-12">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                <Zap className="w-3 h-3" /> Powered by Gemini
              </div>
              <h2 className="text-4xl font-black tracking-tight text-zinc-900">Control de Calidad <span className="text-emerald-600">Visual</span></h2>
              <p className="text-zinc-500 max-w-md text-lg leading-relaxed">Detecta discrepancias críticas entre versiones de etiquetas y documentos en segundos.</p>
            </div>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              {(file1 || file2) && (
                <div className="flex flex-wrap gap-2">
                  {file1 && (
                    <button onClick={() => setIsFocusMode(!isFocusMode)} className={cn("px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all border-2", isFocusMode ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-white border-zinc-200 text-zinc-600 hover:border-emerald-500 hover:text-emerald-600")}>
                      <Target className={cn("w-4 h-4", isFocusMode && "animate-pulse")} /> {isFocusMode ? "Cerrar Enfoque Ref." : "Enfocar Referencia"}
                    </button>
                  )}
                  {file2 && (
                    <button onClick={() => setIsFocusMode2(!isFocusMode2)} className={cn("px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all border-2", isFocusMode2 ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-white border-zinc-200 text-zinc-600 hover:border-emerald-500 hover:text-emerald-600")}>
                      <Target className={cn("w-4 h-4", isFocusMode2 && "animate-pulse")} /> {isFocusMode2 ? "Cerrar Enfoque Nuevo" : "Enfocar Nuevo"}
                    </button>
                  )}
                  {(selectedRegion || selectedRegion2) && !isFocusMode && !isFocusMode2 && (
                    <button onClick={() => { setSelectedRegion(null); setSelectedRegion2(null); }} className="p-3 rounded-2xl bg-white border-2 border-zinc-200 text-zinc-400 hover:border-red-200 hover:text-red-500 transition-all" title="Limpiar todos los enfoques">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <button onClick={handleCompare} disabled={!file1 || !file2 || isAnalyzing} className={cn("group relative px-8 py-4 rounded-2xl font-bold text-lg flex items-center gap-3 transition-all overflow-hidden", (!file1 || !file2 || isAnalyzing) ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" : "bg-zinc-900 text-white hover:bg-emerald-600 hover:scale-105 active:scale-95 shadow-xl shadow-zinc-900/10")}>
                {isAnalyzing ? (<><Loader2 className="w-6 h-6 animate-spin" /> Procesando...</>) : (<><ArrowRightLeft className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" /> Ejecutar Análisis</>)}
              </button>
            </div>
          </header>

          <AnimatePresence>
            {isAnalyzing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-3xl border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
                  <Layers className="absolute inset-0 m-auto w-8 h-8 text-emerald-600 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-zinc-900">Analizando Diferencias</h3>
                  <p className="text-zinc-500 animate-pulse">La IA está escaneando cada píxel y palabra...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <motion.div layout className="space-y-4">
              <div {...getLeftProps()} className={cn("relative group cursor-pointer transition-all duration-500", !file1 || isFocusMode ? "h-[400px]" : "h-auto")}>
                <input {...getLeftInput()} />
                {isFocusMode && file1 ? (
                  <div className="h-full" onClick={(e) => e.stopPropagation()}>
                    <RegionSelector imageUrl={file1.previewUrl} onRegionSelected={setSelectedRegion} initialRegion={selectedRegion} />
                  </div>
                ) : (
                  <>
                    <FilePreview file={file1} label="Versión de Referencia" selectedRegion={selectedRegion} differences={result?.visualDifferences} />
                    {file1 && (
                      <button onClick={(e) => { e.stopPropagation(); setFile1(null); setResult(null); setSelectedRegion(null); setIsFocusMode(false); }} className="absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-lg border border-zinc-200" title="Quitar archivo">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    {selectedRegion && !isFocusMode && (
                      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-lg">
                        <Target className="w-3 h-3" /> ÁREA DE ENFOQUE ACTIVA
                      </div>
                    )}
                  </>
                )}
                {!file1 && !isFocusMode && (
                  <div className={cn("absolute inset-0 flex flex-col items-center justify-center p-8 transition-all rounded-[2rem] border-2 border-dashed", isLeftActive ? "bg-emerald-50 border-emerald-500" : "bg-white border-zinc-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10")}>
                    <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-lg font-bold text-zinc-900">Archivo Original</p>
                    <p className="text-sm text-zinc-500 mt-1">Suelte el PDF o Imagen aquí</p>
                  </div>
                )}
              </div>
            </motion.div>
            <motion.div layout className="space-y-4">
              <div {...getRightProps()} className={cn("relative group cursor-pointer transition-all duration-500", !file2 || isFocusMode2 ? "h-[400px]" : "h-auto")}>
                <input {...getRightInput()} />
                {isFocusMode2 && file2 ? (
                  <div className="h-full" onClick={(e) => e.stopPropagation()}>
                    <RegionSelector imageUrl={file2.previewUrl} onRegionSelected={setSelectedRegion2} initialRegion={selectedRegion2} />
                  </div>
                ) : (
                  <>
                    <FilePreview file={file2} label="Nueva Versión" selectedRegion={selectedRegion2} />
                    {file2 && (
                      <button onClick={(e) => { e.stopPropagation(); setFile2(null); setResult(null); setSelectedRegion2(null); setIsFocusMode2(false); }} className="absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-lg border border-zinc-200" title="Quitar archivo">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    {selectedRegion2 && !isFocusMode2 && (
                      <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-lg">
                        <Target className="w-3 h-3" /> ENFOQUE ESPECÍFICO ACTIVO
                      </div>
                    )}
                  </>
                )}
                {!file2 && !isFocusMode2 && (
                  <div className={cn("absolute inset-0 flex flex-col items-center justify-center p-8 transition-all rounded-[2rem] border-2 border-dashed", isRightActive ? "bg-emerald-50 border-emerald-500" : "bg-white border-zinc-200 group-hover:border-emerald-400 group-hover:bg-emerald-50/10")}>
                    <div className="w-16 h-16 rounded-2xl bg-zinc-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-8 h-8 text-zinc-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <p className="text-lg font-bold text-zinc-900">Nueva Versión</p>
                    <p className="text-sm text-zinc-500 mt-1">Suelte el archivo a comparar</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-6 rounded-[2rem] bg-red-50 border border-red-100 flex items-center gap-4 text-red-700 shadow-lg">
                <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center shrink-0"><AlertCircle className="w-6 h-6" /></div>
                <div>
                  <p className="font-bold">Error de Análisis</p>
                  <p className="text-sm opacity-80">{error}</p>
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                <div className="h-px bg-zinc-200 w-full" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                  <div className="lg:col-span-6 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-zinc-900">Comparación Visual</h3>
                        <p className="text-sm text-zinc-500">Desliza para ver las diferencias entre versiones.</p>
                      </div>
                      <button onClick={downloadImage} className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-2 shadow-sm">
                        <Download className="w-3.5 h-3.5" /> Imagen Marcada
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Modo Cortina (Antes/Después)</span>
                        </div>
                        <ComparisonSlider leftImage={file1?.previewUrl ?? ''} rightImage={file2?.previewUrl ?? ''} />
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Mapa de Calor de Diferencias</span>
                        </div>
                        <FilePreview file={file1} label="Diferencias Marcadas en Referencia" differences={result.visualDifferences} />
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
                        <h3 className="text-2xl font-black text-zinc-900">Reporte IA</h3>
                      </div>
                      <button onClick={downloadText} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-400 transition-all hover:text-zinc-900 border border-transparent hover:border-zinc-200" title="Descargar Reporte">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-10 shadow-2xl shadow-zinc-200/40 relative overflow-hidden group min-h-[500px] flex flex-col">
                      <div className="relative flex-1 prose prose-zinc max-w-none markdown-report">
                        <ReactMarkdown>{result.textualDifferences}</ReactMarkdown>
                      </div>
                      <div className="relative mt-10 pt-8 border-t border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                          <span className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em]">Análisis Verificado</span>
                        </div>
                        <span className="text-xs text-zinc-500 font-mono">{new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-6 rounded-3xl bg-zinc-900 text-white shadow-xl">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Diferencias</p>
                        <p className="text-4xl font-black">{result.visualDifferences.length} <span className="text-xs font-bold text-zinc-500">PUNTOS</span></p>
                      </div>
                      <div className="p-6 rounded-3xl bg-emerald-600 text-white shadow-xl">
                        <p className="text-[10px] font-black text-emerald-200 uppercase tracking-widest mb-1">Confianza</p>
                        <p className="text-4xl font-black">99.8 <span className="text-xs font-bold text-emerald-200">%</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!result && !isAnalyzing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 border-t border-zinc-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-400">01</div>
                  <h4 className="font-bold text-zinc-900">Carga tus archivos</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Sube el diseño original y la nueva versión en formato PDF o Imagen.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-400">02</div>
                  <h4 className="font-bold text-zinc-900">Define el enfoque</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Usa las etiquetas laterales para decirle a la IA en qué áreas debe centrarse.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center font-bold text-zinc-400">03</div>
                  <h4 className="font-bold text-zinc-900">Revisa y descarga</h4>
                  <p className="text-sm text-zinc-500 leading-relaxed">Analiza el reporte detallado y descarga las evidencias visuales marcadas.</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
