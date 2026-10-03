'use client';

import React, { useState, useEffect } from 'react';
import {
  Vote as VoteIcon,
  X,
  Play,
  CheckCircle2,
  Trophy,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { BoardElement } from '@whiteboard/shared';

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  elements: BoardElement[];
  onFocusElement?: (id: string) => void;
  isVotingActive: boolean;
  setIsVotingActive: (active: boolean) => void;
  activeVoteSession: any;
  setActiveVoteSession: (session: any) => void;
}

export function VoteModal({
  isOpen,
  onClose,
  boardId,
  elements,
  onFocusElement,
  isVotingActive,
  setIsVotingActive,
  activeVoteSession,
  setActiveVoteSession,
}: VoteModalProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('Session de vote');
  const [newVotesPerUser, setNewVotesPerUser] = useState(3);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/boards/${boardId}/votes`);
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
        const active = (data.sessions || []).find((s: any) => s.status === 'active');
        setActiveVoteSession(active || null);
        setIsVotingActive(!!active);
      }
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les votes.');
    } finally {
      setLoading(false);
    }
  }, [boardId, setActiveVoteSession, setIsVotingActive]);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      const res = await fetch(`/api/boards/${boardId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          votesPerUser: newVotesPerUser,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActiveVoteSession(data.session);
      setIsVotingActive(true);
      await fetchSessions();
    } catch (e: any) {
      setError(e.message || 'Erreur lors du démarrage du vote.');
    } finally {
      setCreating(false);
    }
  };

  const handleCloseSession = async (sessionId: string) => {
    setClosing(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/votes/${sessionId}/close`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsVotingActive(false);
      await fetchSessions();
    } catch (e: any) {
      setError(e.message || 'Impossible de clôturer le vote.');
    } finally {
      setClosing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <VoteIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Votes & Décisions d&apos;équipe</h2>
              <p className="text-xs text-slate-500">Votes secrets en direct puis révélation collective</p>
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
        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Session active */}
          {activeVoteSession ? (
            <div className="p-5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Vote en cours
                </span>
                <span className="text-xs text-indigo-700 font-medium">
                  {activeVoteSession.totalVotesCast} vote(s) exprimé(s) au total
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-indigo-950">{activeVoteSession.title}</h3>
                <p className="text-xs text-indigo-800/80 mt-0.5">
                  Cliquez sur n&apos;importe quel élément du tableau pour voter ou retirer votre vote.
                </p>
              </div>

              {/* Vos votes */}
              <div className="bg-white/80 backdrop-blur-sm p-3.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Vos votes restants :</span>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                  {activeVoteSession.remainingVotes} / {activeVoteSession.votesPerUser}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCloseSession(activeVoteSession.id)}
                  disabled={closing}
                  className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {closing ? 'Calcul des résultats...' : 'Clôturer et révéler le classement'}
                </button>
              </div>
            </div>
          ) : (
            /* Formulaire nouveau vote */
            <form onSubmit={handleStartSession} className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lancer une nouvelle session</h3>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Titre de la consultation</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex : Choix de la proposition préférée"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre de votes par personne</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={newVotesPerUser}
                    onChange={(e) => setNewVotesPerUser(parseInt(e.target.value, 10))}
                    className="flex-1"
                  />
                  <span className="text-xs font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200">
                    {newVotesPerUser} vote{newVotesPerUser > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Play size={14} />
                {creating ? 'Démarrage...' : 'Ouvrir les votes'}
              </button>
            </form>
          )}

          {/* Historique des sessions et résultats */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Résultats des votes précédents</h3>
            {sessions.filter((s) => s.status === 'closed').length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucune session clôturée pour l&apos;instant.</p>
            ) : (
              sessions
                .filter((s) => s.status === 'closed')
                .map((session) => (
                  <div key={session.id} className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-slate-800">{session.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(session.closedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {session.results && session.results.length > 0 ? (
                      <div className="space-y-1.5">
                        {session.results.slice(0, 5).map((res: any, idx: number) => {
                          const targetEl = elements.find((e) => e.id === res.elementId);
                          const label = targetEl ? (targetEl as any).content || targetEl.type : 'Élément';

                          return (
                            <div
                              key={res.elementId}
                              onClick={() => onFocusElement && onFocusElement(res.elementId)}
                              className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-indigo-50/60 cursor-pointer transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                                    idx === 0
                                      ? 'bg-amber-400 text-amber-950'
                                      : idx === 1
                                      ? 'bg-slate-300 text-slate-800'
                                      : idx === 2
                                      ? 'bg-amber-700/30 text-amber-900'
                                      : 'bg-slate-200 text-slate-600'
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className="truncate text-slate-700 font-medium">{label}</span>
                              </div>
                              <span className="font-bold text-indigo-600 shrink-0 ml-2">
                                {res.count} vote{res.count > 1 ? 's' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Aucun vote n&apos;a été enregistré pendant cette session.</p>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
