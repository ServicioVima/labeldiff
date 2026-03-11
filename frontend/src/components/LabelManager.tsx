import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, Tag, Search as SearchIcon, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import type { LabelDefinition } from '../types';

interface Props {
  labels: LabelDefinition[];
  onLabelsChange: (labels: LabelDefinition[]) => void;
  selectedLabelIds: string[];
  onToggleLabel: (id: string) => void;
}

export const LabelManager: React.FC<Props> = ({ labels, onLabelsChange, selectedLabelIds, onToggleLabel }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(true);

  const filteredLabels = useMemo(() => {
    return labels.filter(label => {
      const matchesSearch = label.name.toLowerCase().includes(searchQuery.toLowerCase()) || label.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = showSelectedOnly ? selectedLabelIds.includes(label.id) : true;
      return matchesSearch && matchesFilter;
    });
  }, [labels, searchQuery, showSelectedOnly, selectedLabelIds]);

  const selectedLabels = useMemo(() => labels.filter(l => selectedLabelIds.includes(l.id)), [labels, selectedLabelIds]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    const newLabel: LabelDefinition = {
      id: crypto.randomUUID(),
      name: newName,
      prompt: newPrompt || `Analiza las diferencias específicas en la sección de ${newName}.`,
    };
    onLabelsChange([newLabel, ...labels]);
    setNewName('');
    setNewPrompt('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    onLabelsChange(labels.filter(l => l.id !== id));
  };

  const handleUpdate = (id: string) => {
    onLabelsChange(labels.map(l => l.id === id ? { ...l, name: newName, prompt: newPrompt } : l));
    setEditingId(null);
    setNewName('');
    setNewPrompt('');
  };

  const startEdit = (label: LabelDefinition) => {
    setEditingId(label.id);
    setNewName(label.name);
    setNewPrompt(label.prompt);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-black text-zinc-900 uppercase tracking-wider">Biblioteca</h2>
          </div>
          <button onClick={() => setIsAdding(true)} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-all border border-zinc-200 bg-white shadow-sm" title="Nueva Etiqueta">
            <Plus className="w-4 h-4 text-zinc-600" />
          </button>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input type="text" placeholder="Buscar etiquetas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 text-xs bg-zinc-50 border border-zinc-100 focus:bg-white focus:border-emerald-500/30 rounded-xl outline-none" />
        </div>
      </div>
      {selectedLabels.length > 0 && (
        <div className="bg-zinc-900 rounded-2xl overflow-hidden shrink-0">
          <button onClick={() => setIsPinnedExpanded(!isPinnedExpanded)} className="w-full px-4 py-3 flex items-center justify-between text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Activas ({selectedLabels.length})</span>
            {isPinnedExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {isPinnedExpanded && (
            <div className="px-3 pb-4 flex flex-wrap gap-2">
              {selectedLabels.map(label => (
                <div key={label.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] font-bold text-white">
                  <span className="truncate max-w-[120px]">{label.name}</span>
                  <button onClick={() => onToggleLabel(label.id)} className="text-zinc-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-3 custom-scrollbar">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{searchQuery ? 'Resultados' : 'Catálogo'}</span>
          <button onClick={() => setShowSelectedOnly(!showSelectedOnly)} className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${showSelectedOnly ? 'text-emerald-600' : 'text-zinc-400 hover:text-zinc-600'}`}>
            <Filter className="w-3 h-3" />{showSelectedOnly ? 'Ver Todas' : 'Seleccionadas'}
          </button>
        </div>
        {isAdding && (
          <div className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/50 space-y-4 mb-4">
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl outline-none bg-white" placeholder="Nombre de la etiqueta" />
            <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl h-24 resize-none outline-none bg-white" placeholder="Instrucciones para la IA..." />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 rounded-lg">Cancelar</button>
              <button onClick={handleAdd} className="px-3 py-1.5 text-xs font-bold bg-zinc-900 text-white rounded-lg hover:bg-zinc-800">Crear Etiqueta</button>
            </div>
          </div>
        )}
        {filteredLabels.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400 italic">No se encontraron etiquetas</p>
        ) : (
          filteredLabels.map(label => {
            const isSelected = selectedLabelIds.includes(label.id);
            return (
              <div key={label.id} className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500/20' : 'border-zinc-200 hover:border-zinc-300 bg-white'}`} onClick={() => onToggleLabel(label.id)}>
                {editingId === label.id ? (
                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg outline-none" placeholder="Nombre" />
                    <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-zinc-200 rounded-lg h-20 resize-none outline-none" placeholder="Prompt" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="text-[10px] font-bold text-zinc-400">CANCELAR</button>
                      <button onClick={() => handleUpdate(label.id)} className="text-[10px] font-bold text-emerald-600">GUARDAR</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 bg-white'}`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-xs text-zinc-900 truncate">{label.name}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); startEdit(label); }} className="p-1 text-zinc-400 hover:text-emerald-600"><Edit2 className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(label.id); }} className="p-1 text-zinc-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5 italic">{label.prompt}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
