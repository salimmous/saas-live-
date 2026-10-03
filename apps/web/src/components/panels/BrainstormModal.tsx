'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  Eye,
  Plus,
  Trash2,
  X,
  Sparkles,
  AlertCircle,
  SendHorizontal,
} from 'lucide-react';
import { BoardElement } from '@whiteboard/shared';

interface BrainstormModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  onBatchAddElements: (elements: BoardElement[]) => void;
  viewportCenter: { x: number; y: number };
}

const COLORS = [
  { name: 'Jaune', value: '#fef08a' },
  { name: 'Bleu', value: '#bae6fd' },
  { name: 'Vert', value: '#bbf7d0' },
  { name: 'Rose', value: '#fbcfe8' },
  { name: 'Violet', value: '#e9d5ff' },
];

export function BrainstormModal({
  isOpen,
  onClose,
  boardId,
  onBatchAddElements,
  viewportCenter,
}: BrainstormModalProps) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState('#fef08a');
  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/boards/${boardId}/drafts`);
      const data = await res.json();
      if (res.ok) {
        setDrafts(data.drafts || []);
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger vos brouillons.');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      fetchDrafts();
    }
  }, [isOpen, fetchDrafts]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          color: selectedColor,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setContent('');
      await fetchDrafts();
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l’enregistrement de l’idée.');
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await fetch(`/api/boards/${boardId}/drafts/${draftId}`, {
        method: 'DELETE',
      });
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    } catch (e: any) {
      setError(e.message || 'Impossible de supprimer.');
    }
  };

  const handleRevealAll = async () => {
    if (drafts.length === 0) return;
    setRevealing(true);
    setError(null);

    try {
      const res = await fetch(`/api/boards/${boardId}/drafts/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originX: viewportCenter.x - 200,
          originY: viewportCenter.y - 150,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Ajouter atomiquement dans Yjs
      if (data.elements && data.elements.length > 0) {
        onBatchAddElements(data.elements);
      }

      setDrafts([]);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la révélation.');
    } finally {
      setRevealing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Brainstorming Privé</h2>
              <p className="text-xs text-slate-500">Idées secrètes, invisibles aux autres jusqu&apos;à la révélation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulaire ajout note secrète */}
          <form onSubmit={handleCreateDraft} className="space-y-3">
            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Rédigez votre idée en toute liberté..."
                rows={3}
                className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                style={{ backgroundColor: selectedColor + '33' }}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Palette de couleur */}
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setSelectedColor(c.value)}
                    className={`w-6 h-6 rounded-full border transition-all ${
                      selectedColor === c.value ? 'ring-2 ring-slate-800 scale-110' : 'border-slate-300'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={!content.trim()}
                className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Plus size={14} />
                Ajouter
              </button>
            </div>
          </form>

          {/* Liste des brouillons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Vos notes privées ({drafts.length})
              </h3>
              <span className="text-[11px] text-amber-700 font-medium bg-amber-100/70 px-2 py-0.5 rounded-full">
                🔒 Non partagées
              </span>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 italic">Chargement de vos notes...</p>
            ) : drafts.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucune note privée. Écrivez vos idées ci-dessus.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                {drafts.map((draft) => {
                  const data = draft.elementData || {};
                  return (
                    <div
                      key={draft.id}
                      className="p-3 rounded-xl border border-slate-200/80 shadow-xs relative group flex flex-col justify-between"
                      style={{ backgroundColor: data.style?.color || '#fef08a' }}
                    >
                      <p className="text-xs text-slate-800 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                        {data.content}
                      </p>
                      <button
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="self-end mt-2 p-1 text-slate-400 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pied de page avec bouton révélation */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            Fermer
          </button>

          <button
            onClick={handleRevealAll}
            disabled={drafts.length === 0 || revealing}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Eye size={15} />
            {revealing
              ? 'Révélation en cours...'
              : `Révéler toutes mes idées (${drafts.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
