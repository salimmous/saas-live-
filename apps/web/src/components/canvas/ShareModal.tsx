'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Trash2, Link2, Shield, UserPlus } from 'lucide-react';

interface GuestLinkItem {
  id: string;
  role: 'editor' | 'reader';
  name?: string;
  createdAt: string;
  url?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

export function ShareModal({ isOpen, onClose, boardId }: ShareModalProps) {
  const [links, setLinks] = useState<GuestLinkItem[]>([]);
  const [role, setRole] = useState<'reader' | 'editor'>('reader');
  const [linkName, setLinkName] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMeet, setCopiedMeet] = useState(false);

  // Charger les liens invités existants
  useEffect(() => {
    if (!isOpen || !boardId) return;

    fetch(`/api/boards/${boardId}/guest-links`)
      .then((res) => res.json())
      .then((data) => {
        if (data.links) setLinks(data.links);
      })
      .catch(console.error);
  }, [isOpen, boardId]);

  // Créer un nouveau lien invité
  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/boards/${boardId}/guest-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name: linkName.trim() || undefined }),
      });

      const data = await res.json();
      if (data.link) {
        setLinks([data.link, ...links]);
        setLinkName('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Révoquer un lien invité immédiatement
  const handleRevokeLink = async (linkId: string) => {
    try {
      await fetch(`/api/boards/${boardId}/guest-links/${linkId}`, {
        method: 'DELETE',
      });
      setLinks(links.filter((l) => l.id !== linkId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-in">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-base">
            <Link2 size={18} className="text-blue-600" />
            <span>Partager le tableau & Réunion Meet</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Bloc d'invitation rapide Meet */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Lien direct Réunion Meet (Audio, Vidéo & Tableau)
                </h4>
              </div>
              <span className="text-[10px] font-semibold bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded-full">
                Direct
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Donnez ce lien à vos collaborateurs. Ils entreront directement dans la salle avec caméra et micro, et vous pourrez autoriser leur accès et contrôler leurs permissions en direct.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/board/${boardId}?meet=true` : ''}
                className="w-full text-xs font-mono bg-white border border-indigo-200 rounded-lg px-3 py-2 text-slate-700 select-all outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(`${window.location.origin}/board/${boardId}?meet=true`);
                    setCopiedMeet(true);
                    setTimeout(() => setCopiedMeet(false), 2000);
                  }
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all shrink-0 flex items-center gap-1.5"
              >
                {copiedMeet ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                <span>{copiedMeet ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>
          </div>

          {/* Formulaire de création de lien invité */}
          <form onSubmit={handleCreateLink} className="space-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Générer un lien invité standard
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rôle accordé</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'reader' | 'editor')}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="reader">Lecteur (Consultation seule)</option>
                  <option value="editor">Éditeur (Modifications en direct)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Libellé (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Équipe Marketing"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>Créer le lien d&apos;invitation</span>
            </button>
          </form>

          {/* Liste des liens actifs */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Liens d&apos;accès actifs
            </h4>

            {links.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                Aucun lien invité actif pour ce tableau.
              </p>
            ) : (
              <div className="space-y-2">
                {links.map((link) => {
                  const shareUrl =
                    link.url || `${window.location.origin}/join/${link.id}`;

                  return (
                    <div
                      key={link.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              link.role === 'editor'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {link.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                          </span>
                          {link.name && (
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {link.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{shareUrl}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(link.id, shareUrl)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Copier le lien"
                        >
                          {copiedId === link.id ? (
                            <Check size={16} className="text-emerald-600" />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeLink(link.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Révoquer immédiatement l'accès"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pied */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}
