'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Upload,
  Check,
  RotateCcw,
  Layers,
  HelpCircle,
  ListTodo,
  FileText,
  Network,
  AlignLeft,
  Loader2,
} from 'lucide-react';
import { BoardElement, BoardOperation, OperationPlan } from '@whiteboard/shared';

interface AiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  elements: BoardElement[];
  selectedIds: string[];
  onApplyOperations: (operations: BoardOperation[]) => void;
  onFocusElement?: (id: string) => void;
}

type TabType = 'diagram' | 'natural' | 'cluster' | 'doc' | 'ask' | 'action';

export function AiPanel({
  isOpen,
  onClose,
  boardId,
  elements,
  selectedIds,
  onApplyOperations,
  onFocusElement,
}: AiPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('diagram');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entrées
  const [diagramPrompt, setDiagramPrompt] = useState('Processus d’intégration client avec vérification KYC');
  const [diagramType, setDiagramType] = useState<'flowchart' | 'mindmap' | 'auto'>('auto');

  const [naturalInstruction, setNaturalInstruction] = useState('Aligne horizontalement ces éléments');
  const [naturalScope, setNaturalScope] = useState<'selection' | 'full_board'>('selection');

  const [docFile, setDocFile] = useState<File | null>(null);
  const [docFormat, setDocFormat] = useState<'mindmap' | 'outline' | 'timeline'>('mindmap');

  const [question, setQuestion] = useState('Quelles sont les priorités identifiées ?');
  const [qaResult, setQaResult] = useState<{ answer: string; referencedIds: string[] } | null>(null);

  // Aperçu du plan d'opérations avant application
  const [pendingPlan, setPendingPlan] = useState<OperationPlan | null>(null);

  if (!isOpen) return null;

  // 1. Génération de diagramme
  const handleGenerateDiagram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagramPrompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, prompt: diagramPrompt, diagramType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingPlan(data.plan);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  // 2. Commande naturelle
  const handleNaturalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalInstruction.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/natural-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          instruction: naturalInstruction,
          scope: naturalScope,
          selectedIds,
          elements,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingPlan(data.plan);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    } finally {
      setLoading(false);
    }
  };

  // 3. Regroupement (Clustering)
  const handleCluster = async () => {
    if (selectedIds.length < 2) {
      setError('Veuillez sélectionner au moins 2 notes adhésives à regrouper.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/cluster-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, selectedIds, elements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingPlan(data.plan);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du regroupement');
    } finally {
      setLoading(false);
    }
  };

  // 4. Document vers tableau
  const handleDocImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('format', docFormat);
      fd.append('boardId', boardId);

      const res = await fetch('/api/ai/doc-to-board', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingPlan(data.plan);
      setDocFile(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’importation du document');
    } finally {
      setLoading(false);
    }
  };

  // 5. Poser une question
  const handleAskBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setQaResult(null);

    try {
      const res = await fetch('/api/ai/ask-board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, question, elements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQaResult(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’analyse');
    } finally {
      setLoading(false);
    }
  };

  // 6. Plan d'action
  const handleActionPlan = async () => {
    if (selectedIds.length === 0) {
      setError('Veuillez sélectionner au moins un élément pour créer des tâches.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, selectedIds, elements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingPlan(data.plan);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du plan d’action');
    } finally {
      setLoading(false);
    }
  };

  // Application du plan d'opérations validé par l'utilisateur (Moteur d'actions unique)
  const confirmApplyPlan = () => {
    if (pendingPlan) {
      onApplyOperations(pendingPlan.operations);
      setPendingPlan(null);
    }
  };

  return (
    <div className="fixed top-20 right-4 bottom-20 w-96 bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-2xl z-40 flex flex-col overflow-hidden animate-scale-in">
      {/* En-tête */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
          <Sparkles className="text-purple-600" size={17} />
          <span>Assistant IA & Automatisation</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
        >
          <X size={17} />
        </button>
      </div>

      {/* Onglets des fonctionnalités IA (Phase 2) */}
      <div className="grid grid-cols-6 border-b border-slate-100 text-xs bg-slate-50/40 p-1 gap-1">
        <button
          onClick={() => setActiveTab('diagram')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'diagram' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Diagramme"
        >
          <Network size={15} />
        </button>
        <button
          onClick={() => setActiveTab('natural')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'natural' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Commande naturelle"
        >
          <AlignLeft size={15} />
        </button>
        <button
          onClick={() => setActiveTab('cluster')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'cluster' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Regrouper"
        >
          <Layers size={15} />
        </button>
        <button
          onClick={() => setActiveTab('doc')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'doc' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Doc vers tableau"
        >
          <FileText size={15} />
        </button>
        <button
          onClick={() => setActiveTab('ask')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'ask' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Questions"
        >
          <HelpCircle size={15} />
        </button>
        <button
          onClick={() => setActiveTab('action')}
          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 font-medium transition-all ${
            activeTab === 'action' ? 'bg-white shadow-xs text-purple-700' : 'text-slate-500 hover:text-slate-800'
          }`}
          title="Plan d'action"
        >
          <ListTodo size={15} />
        </button>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
            {error}
          </div>
        )}

        {/* 1. Diagramme */}
        {activeTab === 'diagram' && (
          <form onSubmit={handleGenerateDiagram} className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Description du processus ou de l&apos;idée
              </label>
              <textarea
                value={diagramPrompt}
                onChange={(e) => setDiagramPrompt(e.target.value)}
                rows={4}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500"
                placeholder="Ex: Processus de livraison avec étape de paiement et contrôle qualité..."
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Format souhaité</label>
              <select
                value={diagramType}
                onChange={(e) => setDiagramType(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
              >
                <option value="auto">Automatique (recommandé)</option>
                <option value="flowchart">Organigramme (Flowchart)</option>
                <option value="mindmap">Arbre d&apos;idées (Mind Map)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Générer le diagramme</span>
            </button>
          </form>
        )}

        {/* 2. Commande Naturelle */}
        {activeTab === 'natural' && (
          <form onSubmit={handleNaturalEdit} className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Instruction en langage naturel
              </label>
              <input
                type="text"
                value={naturalInstruction}
                onChange={(e) => setNaturalInstruction(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500"
                placeholder="Ex: Aligne ces cartes, change la couleur en vert..."
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Périmètre autorisé</label>
              <select
                value={naturalScope}
                onChange={(e) => setNaturalScope(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
              >
                <option value="selection">Sélection actuelle uniquement ({selectedIds.length} éléments)</option>
                <option value="full_board">Tout le tableau</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Exécuter la commande</span>
            </button>
          </form>
        )}

        {/* 3. Regroupement */}
        {activeTab === 'cluster' && (
          <div className="space-y-4">
            <p className="text-slate-500 leading-relaxed">
              Sélectionnez vos notes adhésives éparpillées sur le canvas. L&apos;IA les analysera et
              les regroupera par thème dans des colonnes ou cadres organisés.
            </p>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 font-medium">
              {selectedIds.length} élément(s) actuellement sélectionné(s)
            </div>
            <button
              type="button"
              onClick={handleCluster}
              disabled={loading || selectedIds.length < 2}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
              <span>Regrouper les idées sélectionnées</span>
            </button>
          </div>
        )}

        {/* 4. Document vers tableau */}
        {activeTab === 'doc' && (
          <form onSubmit={handleDocImport} className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Fichier source (TXT, DOCX, PDF)
              </label>
              <input
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Format de sortie</label>
              <select
                value={docFormat}
                onChange={(e) => setDocFormat(e.target.value as any)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none"
              >
                <option value="mindmap">Mind Map auto-adaptative</option>
                <option value="timeline">Frise chronologique (Timeline)</option>
                <option value="outline">Plan structuré en colonnes</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !docFile}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              <span>Transformer en tableau visuel</span>
            </button>
          </form>
        )}

        {/* 5. Questions sur le tableau */}
        {activeTab === 'ask' && (
          <form onSubmit={handleAskBoard} className="space-y-3">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Question sur le contenu
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-purple-500"
                placeholder="Ex: Que prévoyons-nous pour le sprint 2 ?"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <HelpCircle size={14} />}
              <span>Poser la question</span>
            </button>

            {qaResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 mt-3 animate-fade-in">
                <p className="font-medium text-slate-800 leading-relaxed">{qaResult.answer}</p>
                {qaResult.referencedIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1 items-center">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1">Objets liés :</span>
                    {qaResult.referencedIds.map((refId) => (
                      <button
                        key={refId}
                        type="button"
                        onClick={() => onFocusElement?.(refId)}
                        className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-semibold hover:bg-blue-100 transition-colors"
                      >
                        #{refId.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        )}

        {/* 6. Plan d'action */}
        {activeTab === 'action' && (
          <div className="space-y-4">
            <p className="text-slate-500 leading-relaxed">
              Convertit votre sélection d&apos;idées ou de notes en cartes de tâches concrètes avec
              titre, responsable, priorité et échéances.
            </p>
            <button
              type="button"
              onClick={handleActionPlan}
              disabled={loading || selectedIds.length === 0}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <ListTodo size={14} />}
              <span>Transformer en plan d&apos;action ({selectedIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Aperçu fantôme avant application (Moteur d'actions unique) */}
      {pendingPlan && (
        <div className="p-4 bg-purple-50/90 border-t border-purple-200 space-y-2 animate-scale-in">
          <div className="flex items-center justify-between text-purple-900 font-bold">
            <span>Aperçu de la modification</span>
            <span className="text-[10px] bg-purple-200 px-2 py-0.5 rounded-full">
              {pendingPlan.operations.length} opération(s)
            </span>
          </div>
          <p className="text-[11px] text-purple-700">{pendingPlan.summary}</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={confirmApplyPlan}
              className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg flex items-center justify-center gap-1"
            >
              <Check size={13} />
              <span>Valider & Insérer</span>
            </button>
            <button
              type="button"
              onClick={() => setPendingPlan(null)}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium rounded-lg"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
