'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  Plus,
  Loader2,
  Calendar,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { BoardElement } from '@whiteboard/shared';

interface Snapshot {
  id: string;
  version: number;
  createdAt: string;
  createdBy: string;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  elements: BoardElement[];
  onRestoreVersion: (elements: BoardElement[], version: number) => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  boardId,
  elements,
  onRestoreVersion,
}: HistoryModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [totalUpdates, setTotalUpdates] = useState(0);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSnapshots = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/snapshots`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSnapshots(data.snapshots || []);
      setTotalUpdates(data.totalUpdates || 0);
    } catch (err: any) {
      setError(err.message || 'Impossible de récupérer les versions.');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      fetchSnapshots();
    }
  }, [isOpen, fetchSnapshots]);

  const handleCreateSnapshot = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg(`Version #${data.snapshot.version} enregistrée avec succès.`);
      fetchSnapshots();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création du point de restauration.');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snapshot: Snapshot) => {
    if (
      !confirm(
        `Voulez-vous restaurer le tableau à la version #${snapshot.version} ? Les modifications non enregistrées seront remplacées.`
      )
    ) {
      return;
    }

    setRestoringId(snapshot.id);
    setError(null);

    try {
      const res = await fetch(`/api/boards/${boardId}/snapshots/${snapshot.id}/restore`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.elements) {
        onRestoreVersion(data.elements, snapshot.version);
      }
      setSuccessMsg(data.message || `Version #${snapshot.version} restaurée.`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la restauration.');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
              <History size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Historique des versions & Checkpoints
              </h2>
              <p className="text-[11px] text-slate-500">
                {totalUpdates} modification(s) incrémentale(s) enregistrée(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle size={15} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Bouton de sauvegarde manuelle */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-slate-800 text-xs">
                État actuel du tableau
              </div>
              <div className="text-[11px] text-slate-500">
                {elements.length} élément(s) présent(s) sur le canvas
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>Créer un point de sauvegarde</span>
            </button>
          </div>

          {/* Timeline des snapshots */}
          <div className="space-y-3">
            <span className="font-bold text-slate-800 text-xs block">
              Points de restauration ({snapshots.length})
            </span>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin text-blue-600" />
                <span>Chargement de la chronologie...</span>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4">
                Aucun checkpoint archivé pour ce tableau pour l&apos;instant.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-between gap-3 transition-colors shadow-2xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md text-[10px]">
                          v{snap.version}
                        </span>
                        <span className="font-bold text-slate-800 text-xs truncate">
                          Point de contrôle #{snap.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                        <Calendar size={11} />
                        <span>{formatDate(snap.createdAt)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRestore(snap)}
                      disabled={restoringId === snap.id}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors border border-slate-200 hover:border-blue-200"
                    >
                      {restoringId === snap.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      <span>Restaurer</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
