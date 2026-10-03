'use client';

import React, { useState } from 'react';
import { Link2, X, AlertCircle, Loader2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { BoardElement } from '@whiteboard/shared';

interface LinkPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddElement: (element: BoardElement) => void;
  viewportCenter: { x: number; y: number };
}

export function LinkPreviewModal({
  isOpen,
  onClose,
  onAddElement,
  viewportCenter,
}: LinkPreviewModalProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      let finalUrl = url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }

      const res = await fetch('/api/link-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Créer l'élément de carte d'aperçu de lien
      const linkElement: BoardElement = {
        id: nanoid(),
        type: 'link',
        x: viewportCenter.x - 160,
        y: viewportCenter.y - 100,
        width: 320,
        height: 180,
        rotation: 0,
        zIndex: 20,
        url: finalUrl,
        title: data.title || finalUrl,
        description: data.description || '',
        image: data.image || undefined,
        favicon: data.favicon || undefined,
        meta: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      };

      onAddElement(linkElement);
      setUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Impossible de charger l’aperçu du lien.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Link2 size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Insérer un lien web</h2>
              <p className="text-xs text-slate-500">Carte d&apos;aperçu interactive enrichie (OpenGraph)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com ou https://example.com"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              autoFocus
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Chargement de l’aperçu...' : 'Ajouter la carte'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
