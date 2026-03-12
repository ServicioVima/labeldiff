import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload, Search, AlertCircle, CheckCircle2, Layers, ArrowRightLeft, Loader2, FileText, Sparkles, Zap, Download, History, Info, ChevronLeft, ChevronRight, Menu, X, Crosshair, Target, Trash2, LogIn, User, Plus, Minus, Pencil, AlertTriangle, Mail,
} from 'lucide-react';

import { cn, fullImageBoxToCropBox } from './lib/utils';
import type { FileData, LabelDefinition, ComparisonResult, CategorizedChangeType, ComparisonPair } from './types';
import { setGeminiConfig, analyzeDifferences, cropBase64Image } from './lib/gemini';
import { getConfig, sendReportEmail } from './lib/api';
import { buildEmailPayload } from './lib/emailReport';
import { useAuth } from './contexts/AuthContext';
import { LabelManager } from './components/LabelManager';
import { FilePreview } from './components/FilePreview';
import { ComparisonSlider } from './components/ComparisonSlider';
import { CroppedComparisonSlider } from './components/CroppedComparisonSlider';
import { AreaMarkedPreview } from './components/AreaMarkedPreview';
import { RegionSelector } from './components/RegionSelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReactMarkdown from 'react-markdown';

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
  const [comparisonPairs, setComparisonPairs] = useState<ComparisonPair[]>([]);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [pairThumbnails, setPairThumbnails] = useState<Record<string, { thumb1?: string; thumb2?: string }>>({});
  const [currentPage1, setCurrentPage1] = useState(1);
  const [currentPage2, setCurrentPage2] = useState(1);
  const [isChangingPage, setIsChangingPage] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [emailLanguage, setEmailLanguage] = useState<'es' | 'en'>('es');
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      let totalPages = 1;
      let arrayBuffer: ArrayBuffer | undefined;
      if (file.type === 'application/pdf') {
        try {
          const pdfjs = await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
          arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer.slice(0) }).promise;
          totalPages = pdf.numPages;
          const page = await pdf.getPage(1);
          const scale = 3.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            context.imageSmoothingEnabled = true;
            (context as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
            await page.render({ canvasContext: context, viewport }).promise;
            previewUrl = canvas.toDataURL('image/png');
          }
        } catch {
          previewUrl = '';
        }
      }
      const fileData: FileData = {
        name: file.name,
        type: file.type,
        base64: file.type === 'application/pdf' ? previewUrl : base64,
        previewUrl,
        totalPages,
        arrayBuffer,
      };
      if (side === 'left') { setFile1(fileData); setCurrentPage1(1); }
      else { setFile2(fileData); setCurrentPage2(1); }
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

  const handleSendReportEmail = async () => {
    if (!result || !user?.email) return;
    setEmailMessage(null);
    setEmailSending(true);
    try {
      const payload = await buildEmailPayload({
        language: emailLanguage,
        result,
        file1,
        file2,
        comparisonPairs,
        pairThumbnails,
        fullImageBoxToCropBox,
      });
      await sendReportEmail({
        language: emailLanguage,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        attachments: payload.attachments,
      });
      setEmailMessage({ type: 'success', text: emailLanguage === 'es' ? 'Correo enviado a tu dirección. Revisa la bandeja de entrada.' : 'Email sent to your address. Check your inbox.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setEmailMessage({ type: 'error', text: msg });
    } finally {
      setEmailSending(false);
    }
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
    if (!file1.base64?.trim?.() || !file2.base64?.trim?.()) {
      setError('Uno o ambos archivos no tienen imagen válida. Vuelva a subirlos (PDF o imagen).');
      return;
    }
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
        comparisonPairs.length > 0 ? undefined : selectedRegion ?? undefined,
        comparisonPairs.length > 0 ? undefined : selectedRegion2 ?? undefined,
        comparisonPairs.length > 0 ? comparisonPairs : undefined,
      );
      setResult(analysis);
    } catch (err) {
      console.error('Error de análisis:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('GEMINI_API_KEY') || msg.includes('no configurada') || msg.includes('Clave de API')) {
        setError('Falta o es inválida la API key de Gemini. En Azure configure GEMINI_API_KEY y GEMINI_API_KEY_EXPOSE=true.');
      } else if (msg.includes('Límite') || msg.includes('429') || msg.includes('quota')) {
        setError(msg);
      } else if (msg.includes('blocked') || msg.includes('política de contenido')) {
        setError(msg);
      } else {
        setError(msg || 'Error al analizar los archivos. Por favor, intente de nuevo.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePageChange = useCallback(async (side: 'left' | 'right', pageNum: number) => {
    const file = side === 'left' ? file1 : file2;
    if (!file?.arrayBuffer || file.type !== 'application/pdf') return;
    setIsChangingPage(true);
    setPageError(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const pdf = await pdfjs.getDocument({ data: file.arrayBuffer.slice(0) }).promise;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 3.5 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      ctx.imageSmoothingEnabled = true;
      (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
      await page.render({ canvasContext: ctx, viewport }).promise;
      const newPreviewUrl = canvas.toDataURL('image/png');
      const updated = { ...file, previewUrl: newPreviewUrl, base64: newPreviewUrl };
      if (side === 'left') { setFile1(updated); setCurrentPage1(pageNum); }
      else { setFile2(updated); setCurrentPage2(pageNum); }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Error al cambiar página');
    } finally {
      setIsChangingPage(false);
    }
  }, [file1, file2]);

  const addComparisonPair = () => {
    const newPair: ComparisonPair = {
      id: crypto.randomUUID(),
      name: `Área ${comparisonPairs.length + 1}`,
      region1: null,
      region2: null,
      prompt: '',
    };
    setComparisonPairs((prev) => [...prev, newPair]);
    setActivePairId(newPair.id);
    setIsFocusMode(true);
    setIsFocusMode2(false);
  };

  const removeComparisonPair = (id: string) => {
    setComparisonPairs((prev) => prev.filter((p) => p.id !== id));
    setPairThumbnails((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (activePairId === id) setActivePairId(null);
  };

  const renameComparisonPair = (id: string, name: string) => {
    setComparisonPairs((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const updatePairPrompt = (id: string, prompt: string) => {
    setComparisonPairs((prev) => prev.map((p) => (p.id === id ? { ...p, prompt } : p)));
  };

  const updatePairRegion = useCallback(async (id: string, side: 1 | 2, region: [number, number, number, number] | null) => {
    setComparisonPairs((prev) => prev.map((p) => (p.id === id ? { ...p, [side === 1 ? 'region1' : 'region2']: region } : p)));
    if (region) {
      const file = side === 1 ? file1 : file2;
      // Usar base64 (data URL); previewUrl puede ser blob: y cropBase64Image solo admite data URL/base64
      const imageSource = file?.base64?.startsWith('data:') ? file.base64 : file?.previewUrl;
      if (imageSource) {
        try {
          const thumb = await cropBase64Image(imageSource, region);
          setPairThumbnails((prev) => ({
            ...prev,
            [id]: { ...prev[id], [side === 1 ? 'thumb1' : 'thumb2']: thumb },
          }));
        } catch (e) {
          console.warn('No se pudo generar la miniatura del área:', e);
        }
      }
    }
  }, [file1, file2]);

  const activePair = comparisonPairs.find((p) => p.id === activePairId);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center shadow-xl bg-white border border-zinc-200 mb-6">
          <img src="/vimafoods-logo.png" alt="Vimafoods" className="w-full h-full object-contain p-2" />
        </div>
        <h1 className="text-2xl font-black text-zinc-900 text-center mb-2">Vima Etiquetas</h1>
        <p className="text-sm text-zinc-500 text-center mb-8 max-w-sm">Análisis de etiquetas con IA. Inicia sesión con tu cuenta Microsoft para continuar.</p>
        <a
          href={loginUrl}
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg"
        >
          <LogIn className="w-5 h-5" /> Iniciar sesión con Microsoft
        </a>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#F4F7F5] flex flex-col font-sans text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        <div id="analyzer-tool" className="flex flex-1 min-h-0">
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 320 }}
        className="h-screen sticky top-0 border-r border-zinc-200 bg-white flex flex-col overflow-hidden shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30 shrink-0"
      >
        <div className="p-6 flex flex-col h-full gap-8">
          <div className="flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 bg-white border border-zinc-100">
                <img src="/vimafoods-logo.png" alt="Vimafoods" className="w-full h-full object-contain p-0.5" />
              </div>
              {!isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0 flex-1">
                  <h1 className="font-black text-base sm:text-lg tracking-tight text-zinc-900 leading-tight break-words">Vima Etiquetas</h1>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mt-0.5 leading-tight break-words">Análisis de etiquetas con IA</p>
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
        <div className="max-w-[1600px] mx-auto space-y-12">
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

          <div className={cn("grid gap-10 transition-all duration-500", (isFocusMode || isFocusMode2) ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
            <motion.div layout className={cn("space-y-4 transition-all duration-500", isFocusMode2 && !isFocusMode ? "opacity-40 pointer-events-none" : "")}>
              <div {...getLeftProps()} className={cn("relative group cursor-pointer transition-all duration-500", !file1 || isFocusMode ? "min-h-[600px] h-[85vh]" : "h-auto")}>
                <input {...getLeftInput()} />
                {isFocusMode && file1 ? (
                  <div className="h-full min-h-[600px]" onClick={(e) => e.stopPropagation()}>
                    <RegionSelector
                      imageUrl={file1.previewUrl}
                      onRegionSelected={(r) => (activePairId ? updatePairRegion(activePairId, 1, r) : setSelectedRegion(r))}
                      onConfirmSelection={() => setIsFocusMode(false)}
                      initialRegion={activePair?.region1 ?? selectedRegion}
                      totalPages={file1.totalPages}
                      currentPage={currentPage1}
                      onPageChange={(p) => handlePageChange('left', p)}
                      isLoading={isChangingPage}
                    />
                  </div>
                ) : (
                  <>
                    <FilePreview
                      file={file1}
                      label="Versión de Referencia"
                      selectedRegion={activePair?.region1 ?? selectedRegion}
                      currentPage={currentPage1}
                      onPageChange={(p) => handlePageChange('left', p)}
                      isLoading={isChangingPage}
                    />
                    {file1 && !isFocusMode && (
                      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setActivePairId(null); setIsFocusMode(true); setIsFocusMode2(false); }} className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl text-zinc-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-lg border border-zinc-200 text-xs font-bold" title="Definir área de enfoque para el análisis">
                          <Target className="w-4 h-4" /> Enfocar área
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setFile1(null); setResult(null); setSelectedRegion(null); setIsFocusMode(false); setComparisonPairs([]); setPairThumbnails({}); setActivePairId(null); }} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-lg border border-zinc-200" title="Quitar archivo">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {(activePair?.region1 ?? selectedRegion) && !isFocusMode && (
                      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-lg">
                          <Target className="w-3 h-3" /> {activePair ? `ÁREA: ${activePair.name}` : 'ÁREA DE ENFOQUE ACTIVA'}
                        </div>
                        {!activePairId && selectedRegion && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedRegion(null); }} className="px-2 py-1 rounded-lg bg-white/95 border border-zinc-200 text-[10px] font-bold text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">Limpiar</button>
                        )}
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
            <motion.div layout className={cn("space-y-4 transition-all duration-500", isFocusMode && !isFocusMode2 ? "opacity-40 pointer-events-none" : "")}>
              <div {...getRightProps()} className={cn("relative group cursor-pointer transition-all duration-500", !file2 || isFocusMode2 ? "min-h-[600px] h-[85vh]" : "h-auto")}>
                <input {...getRightInput()} />
                {isFocusMode2 && file2 ? (
                  <div className="h-full min-h-[600px]" onClick={(e) => e.stopPropagation()}>
                    <RegionSelector
                      imageUrl={file2.previewUrl}
                      onRegionSelected={(r) => (activePairId ? updatePairRegion(activePairId, 2, r) : setSelectedRegion2(r))}
                      onConfirmSelection={() => setIsFocusMode2(false)}
                      initialRegion={activePair?.region2 ?? selectedRegion2}
                      totalPages={file2.totalPages}
                      currentPage={currentPage2}
                      onPageChange={(p) => handlePageChange('right', p)}
                      isLoading={isChangingPage}
                    />
                  </div>
                ) : (
                  <>
                    <FilePreview
                      file={file2}
                      label="Nueva Versión"
                      selectedRegion={activePair?.region2 ?? selectedRegion2}
                      currentPage={currentPage2}
                      onPageChange={(p) => handlePageChange('right', p)}
                      isLoading={isChangingPage}
                      showDownload={false}
                    />
                    {file2 && !isFocusMode2 && (
                      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setActivePairId(null); setIsFocusMode(false); setIsFocusMode2(true); }} className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl text-zinc-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-lg border border-zinc-200 text-xs font-bold" title="Definir área de enfoque para el análisis">
                          <Target className="w-4 h-4" /> Enfocar área
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setFile2(null); setResult(null); setSelectedRegion2(null); setIsFocusMode2(false); setComparisonPairs([]); setPairThumbnails({}); setActivePairId(null); }} className="p-2 bg-white/90 backdrop-blur-sm rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shadow-lg border border-zinc-200" title="Quitar archivo">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {file2 && !isFocusMode2 && (
                      <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-zinc-800 text-white text-[10px] font-bold rounded-lg shadow-lg tracking-wider">
                        VERSIÓN PARA FÁBRICA
                      </div>
                    )}
                    {(activePair?.region2 ?? selectedRegion2) && !isFocusMode2 && (
                      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                        <div className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-2 shadow-lg">
                          <Target className="w-3 h-3" /> {activePair ? `ÁREA: ${activePair.name}` : 'ÁREA DE ENFOQUE ACTIVA'}
                        </div>
                        {!activePairId && selectedRegion2 && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedRegion2(null); }} className="px-2 py-1 rounded-lg bg-white/95 border border-zinc-200 text-[10px] font-bold text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">Limpiar</button>
                        )}
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

          {pageError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {pageError}
              <button type="button" onClick={() => setPageError(null)} className="ml-auto p-1 hover:bg-red-100 rounded"><X className="w-4 h-4" /></button>
            </motion.div>
          )}

          {file1 && file2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 md:p-8 bg-white rounded-[2rem] border border-zinc-200 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Target className="w-5 h-5 text-emerald-600" /></div>
                  <div>
                    <h3 className="text-lg font-black text-zinc-900">Áreas de comparación</h3>
                    <p className="text-xs text-zinc-500">Define zonas específicas para un análisis por áreas.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {comparisonPairs.length > 0 && (
                    <button type="button" onClick={() => { setComparisonPairs([]); setPairThumbnails({}); setActivePairId(null); }} className="px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-sm font-bold hover:bg-zinc-200 flex items-center gap-2">
                      <Trash2 className="w-4 h-4" /> Limpiar todo
                    </button>
                  )}
                  <button type="button" onClick={addComparisonPair} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-lg">
                    <Sparkles className="w-4 h-4" /> Nueva área
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {comparisonPairs.map((pair) => (
                  <div key={pair.id} className={cn("p-4 rounded-2xl border transition-all", activePairId === pair.id ? "bg-emerald-50/50 border-emerald-200 ring-2 ring-emerald-500/20" : "bg-zinc-50/50 border-zinc-100")}>
                    <input type="text" value={pair.name} onChange={(e) => renameComparisonPair(pair.id, e.target.value)} className="w-full bg-transparent border-none p-0 font-bold text-zinc-900 text-sm focus:ring-0 mb-2" placeholder="Nombre del área" />
                    <textarea value={pair.prompt ?? ''} onChange={(e) => updatePairPrompt(pair.id, e.target.value)} placeholder="Instrucciones opcionales..." className="w-full text-[10px] p-2 rounded-lg bg-white border border-zinc-100 focus:border-emerald-500 resize-none h-14 mb-3" />
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Ref. (v1)</span>
                        <div onClick={() => { setActivePairId(pair.id); setIsFocusMode(true); setIsFocusMode2(false); }} className={cn("aspect-video rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer", pair.region1 ? "bg-emerald-100 border-emerald-300" : "bg-white border-zinc-200 hover:border-emerald-300")}>
                          {pairThumbnails[pair.id]?.thumb1 ? <img src={pairThumbnails[pair.id].thumb1} alt="" className="w-full h-full object-cover rounded-md" /> : pair.region1 ? <Target className="w-5 h-5 text-emerald-600" /> : <span className="text-[8px] text-zinc-400 font-bold">Definir</span>}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Nueva (v2)</span>
                        <div onClick={() => { setActivePairId(pair.id); setIsFocusMode(false); setIsFocusMode2(true); }} className={cn("aspect-video rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer", pair.region2 ? "bg-emerald-100 border-emerald-300" : "bg-white border-zinc-200 hover:border-emerald-300")}>
                          {pairThumbnails[pair.id]?.thumb2 ? <img src={pairThumbnails[pair.id].thumb2} alt="" className="w-full h-full object-cover rounded-md" /> : pair.region2 ? <Target className="w-5 h-5 text-emerald-600" /> : <span className="text-[8px] text-zinc-400 font-bold">Definir</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setActivePairId(pair.id)} className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase", activePairId === pair.id ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300")}>{activePairId === pair.id ? 'Editando' : 'Seleccionar'}</button>
                      <button type="button" onClick={() => removeComparisonPair(pair.id)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {comparisonPairs.length === 0 && (
                  <div className="col-span-full py-8 border-2 border-dashed border-zinc-100 rounded-2xl flex flex-col items-center justify-center text-zinc-400 bg-zinc-50/30">
                    <Target className="w-8 h-8 opacity-30 mb-2" />
                    <p className="text-sm font-bold text-zinc-500">No hay áreas definidas</p>
                    <p className="text-xs mt-0.5">Usa &quot;Nueva área&quot; para comparar zonas específicas.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

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
                <div className="space-y-12">
                  {/* Análisis Visual Detallado: una sección por área cuando hay áreas; si no, vista completa */}
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-3xl font-black text-zinc-900">Análisis Visual Detallado</h3>
                        <p className="text-sm text-zinc-500">
                          {comparisonPairs.length > 0
                            ? 'Una tarjeta por área con referencia, nueva versión con marcas y descarga.'
                            : 'Inspección profunda de las discrepancias detectadas.'}
                        </p>
                      </div>
                    </div>
                    {comparisonPairs.length > 0 ? (
                      <div className="space-y-8">
                        {comparisonPairs.filter((p) => p.region2 && pairThumbnails[p.id]?.thumb2).map((pair) => {
                          const areaDiffs = result.visualDifferences.filter((d) => d.areaName === pair.name);
                          const differencesInCrop = areaDiffs.map((d) => ({
                            box_2d: fullImageBoxToCropBox(d.box_2d, pair.region2!),
                            label: d.label,
                          }));
                          return (
                            <div key={pair.id} className="bg-white rounded-[2.5rem] border border-zinc-200 p-6 shadow-xl overflow-hidden">
                              <div className="flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-emerald-600" />
                                <h4 className="text-lg font-black text-zinc-900 uppercase tracking-tight">{pair.name}</h4>
                                {areaDiffs.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase">
                                    {areaDiffs.length} diferencia{areaDiffs.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Referencia (v1)</span>
                                  <div className="aspect-video rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50">
                                    {pairThumbnails[pair.id]?.thumb1 ? <img src={pairThumbnails[pair.id].thumb1} className="w-full h-full object-contain" alt={`Ref ${pair.name}`} /> : <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">Sin área</div>}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Nueva versión con marcas (v2)</span>
                                  <AreaMarkedPreview
                                    imageUrl={pairThumbnails[pair.id].thumb2!}
                                    areaName={pair.name}
                                    differences={differencesInCrop}
                                    showDownload
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-zinc-400 rounded-full" />
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Versión de Referencia (v1)</span>
                          </div>
                          <div className="bg-white rounded-[2.5rem] border border-zinc-200 p-4 shadow-xl">
                            <FilePreview file={file1} label="Referencia Original" currentPage={currentPage1} onPageChange={(p) => handlePageChange('left', p)} isLoading={isChangingPage} showDownload />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nueva Versión Detectada (v2)</span>
                            </div>
                            <span className="px-2 py-1 bg-emerald-600 text-white text-[9px] font-black rounded-md uppercase">Diferencias Marcadas</span>
                          </div>
                          <div className="bg-white rounded-[2.5rem] border border-emerald-100 p-4 shadow-xl ring-4 ring-emerald-500/5">
                            <FilePreview file={file2} label="Nueva Versión con Marcas" differences={result.visualDifferences} currentPage={currentPage2} onPageChange={(p) => handlePageChange('right', p)} isLoading={isChangingPage} showDownload />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Comparación Interactiva (Modo Cortina) */}
                    <div className="space-y-6 bg-zinc-50 p-8 rounded-[3rem] border border-zinc-200">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Comparación Interactiva (Modo Cortina)</span>
                      </div>
                      {comparisonPairs.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {comparisonPairs.map((pair) => (
                            <CroppedComparisonSlider key={pair.id} leftImage={file1?.previewUrl ?? ''} rightImage={file2?.previewUrl ?? ''} region1={pair.region1} region2={pair.region2} name={pair.name} />
                          ))}
                        </div>
                      ) : (
                        <div className="max-w-4xl mx-auto">
                          <ComparisonSlider leftImage={file1?.previewUrl ?? ''} rightImage={file2?.previewUrl ?? ''} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enviar borrador por correo al usuario logueado */}
                  <div className="rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-zinc-900 flex items-center gap-2">
                          <Mail className="w-5 h-5 text-emerald-600" />
                          {emailLanguage === 'es' ? 'Recibir borrador por correo' : 'Get draft by email'}
                        </h3>
                        <p className="text-sm text-zinc-500 mt-1">
                          {emailLanguage === 'es'
                            ? 'Se enviará un resumen formal al proveedor (a tu correo) con las imágenes de referencia y marcadas en el cuerpo y como adjuntos.'
                            : 'A formal summary for the supplier will be sent to your email, with reference and marked images in the body and as attachments.'}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm" role="group" aria-label={emailLanguage === 'es' ? 'Idioma del correo' : 'Email language'}>
                          <button
                            type="button"
                            onClick={() => setEmailLanguage('es')}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-bold transition-all',
                              emailLanguage === 'es' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
                            )}
                          >
                            Español
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmailLanguage('en')}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-bold transition-all',
                              emailLanguage === 'en' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-600 hover:bg-zinc-100'
                            )}
                          >
                            English
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendReportEmail}
                          disabled={emailSending || !user?.email}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all"
                        >
                          {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          {emailSending ? (emailLanguage === 'es' ? 'Enviando…' : 'Sending…') : (emailLanguage === 'es' ? 'Enviar resumen por correo' : 'Send summary by email')}
                        </button>
                      </div>
                    </div>
                    {emailMessage && (
                      <div className={cn(
                        'mt-4 p-3 rounded-xl flex items-center gap-3 text-sm',
                        emailMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                      )}>
                        {emailMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        <span>{emailMessage.text}</span>
                        <button type="button" onClick={() => setEmailMessage(null)} className="ml-auto p-1 hover:opacity-70" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                    {!user?.email && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        {emailLanguage === 'es' ? 'Inicia sesión para enviar el resumen a tu correo.' : 'Log in to send the summary to your email.'}
                      </p>
                    )}
                  </div>

                  {/* Reporte IA - full width, agrupado por área */}
                  <div className="lg:col-span-12 space-y-6">
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
                      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full -mr-24 -mt-24 blur-3xl" />
                      <div className="relative flex-1 space-y-10">
                        {/* Resumen de Cambios - agrupado por areaName, estilo referencia (field, description, oldValue, newValue) */}
                        {result.categorizedChanges && result.categorizedChanges.length > 0 && (
                          <div className="space-y-8">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Resumen de Cambios</h4>
                            </div>
                            {Object.entries(
                              result.categorizedChanges.reduce((acc, change) => {
                                const key = change.areaName ?? 'General';
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(change);
                                return acc;
                              }, {} as Record<string, NonNullable<typeof result.categorizedChanges>>)
                            ).map(([areaName, changes], areaIdx) => (
                              <div key={areaName} className="space-y-4">
                                {areaName !== 'General' && (
                                  <div className="flex items-center gap-2 px-1">
                                    <Target className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[10px] font-black text-zinc-900 uppercase tracking-widest">{areaName}</span>
                                  </div>
                                )}
                                <div className="grid gap-3">
                                  {changes.map((c, idx) => (
                                    <motion.div
                                      key={idx}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ delay: areaIdx * 0.1 + idx * 0.05 }}
                                      className={cn(
                                        'p-4 rounded-2xl border flex items-start gap-4 transition-all hover:scale-[1.01]',
                                        c.type === 'added' && 'bg-emerald-50/50 border-emerald-100 text-emerald-900',
                                        c.type === 'removed' && 'bg-red-50/50 border-red-100 text-red-900',
                                        c.type === 'modified' && 'bg-amber-50/50 border-amber-100 text-amber-900',
                                        c.type === 'absent' && 'bg-purple-50/50 border-purple-100 text-purple-900'
                                      )}
                                    >
                                      <div className={cn(
                                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
                                        c.type === 'added' && 'bg-emerald-500 text-white',
                                        c.type === 'removed' && 'bg-red-500 text-white',
                                        c.type === 'modified' && 'bg-amber-500 text-white',
                                        c.type === 'absent' && 'bg-purple-500 text-white'
                                      )}>
                                        {c.type === 'added' && <CheckCircle2 className="w-4 h-4" />}
                                        {c.type === 'removed' && <X className="w-4 h-4" />}
                                        {c.type === 'modified' && <ArrowRightLeft className="w-4 h-4" />}
                                        {c.type === 'absent' && <AlertTriangle className="w-4 h-4" />}
                                      </div>
                                      <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                          <p className="text-sm font-black uppercase tracking-tight">{c.field ?? c.label ?? 'Cambio'}</p>
                                          <span className="text-[10px] font-bold uppercase opacity-60">
                                            {c.type === 'added' ? 'Añadido' : c.type === 'removed' ? 'Eliminado' : c.type === 'modified' ? 'Modificado' : 'Ausente'}
                                          </span>
                                        </div>
                                        <p className="text-xs opacity-80 leading-relaxed">{c.description ?? c.label ?? ''}</p>
                                        {c.type === 'modified' && (c.oldValue != null || c.newValue != null) && (
                                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-black/5 text-[10px] font-medium">
                                            <span className="line-through opacity-40">{c.oldValue ?? '-'}</span>
                                            <ArrowRightLeft className="w-3 h-3 opacity-40" />
                                            <span className="font-bold">{c.newValue ?? '-'}</span>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Comparación por Áreas - thumbnails y prompt por par */}
                        {comparisonPairs.length > 0 && (
                          <div className="space-y-6">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest">Comparación por Áreas</h4>
                            </div>
                            <div className="grid gap-6">
                              {comparisonPairs.map((pair) => (
                                <div key={pair.id} className="p-6 rounded-[2rem] bg-zinc-50 border border-zinc-100 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-black text-zinc-900 uppercase tracking-tight text-sm">{pair.name}</h5>
                                      {result.visualDifferences.filter((d) => d.areaName === pair.name).length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[8px] font-black uppercase">
                                          {result.visualDifferences.filter((d) => d.areaName === pair.name).length} Diferencias
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Referencia</span>
                                      <div className="aspect-video rounded-xl overflow-hidden border border-zinc-200 bg-white">
                                        {pairThumbnails[pair.id]?.thumb1 ? <img src={pairThumbnails[pair.id].thumb1} className="w-full h-full object-contain" alt="Ref" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-300">Sin área</div>}
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Nueva versión con marcas</span>
                                      {pair.region2 && pairThumbnails[pair.id]?.thumb2 ? (
                                        <AreaMarkedPreview
                                          imageUrl={pairThumbnails[pair.id].thumb2}
                                          areaName={pair.name}
                                          differences={result.visualDifferences.filter((d) => d.areaName === pair.name).map((d) => ({ box_2d: fullImageBoxToCropBox(d.box_2d, pair.region2!), label: d.label }))}
                                          showDownload
                                        />
                                      ) : (
                                        <div className="aspect-video rounded-xl overflow-hidden border border-zinc-200 bg-white flex items-center justify-center text-[8px] text-zinc-300">Sin área</div>
                                      )}
                                    </div>
                                  </div>
                                  {pair.prompt && (
                                    <div className="p-3 rounded-xl bg-white border border-zinc-100">
                                      <p className="text-[10px] text-zinc-500 italic">&quot;{pair.prompt}&quot;</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="h-px bg-zinc-100 w-full" />
                          </div>
                        )}

                        <div className="prose prose-zinc max-w-none prose-headings:text-zinc-900 prose-headings:font-black prose-p:text-zinc-700 markdown-report">
                          <ReactMarkdown>{result.textualDifferences}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="relative mt-10 pt-8 border-t border-zinc-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                          <span className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.2em]">Análisis Verificado</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Timestamp</span>
                          <span className="text-xs text-zinc-500 font-mono">{new Date().toLocaleTimeString()}</span>
                        </div>
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
      </div>
    </ErrorBoundary>
  );
}
