'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Trash2,
  Video,
  Radio,
  Clock,
  User,
  Loader2,
  CheckCircle,
} from 'lucide-react';

interface Tour {
  id: string;
  title: string;
  duration: number;
  trajectoryData: any[];
  createdAt: string;
  creator?: {
    name: string;
    email: string;
  };
}

interface TourModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  onPlayTour: (tour: Tour) => void;
  isRecordingTour: boolean;
  onStartRecordingTour: (title: string) => void;
  onStopRecordingTour: () => void;
  recordingDuration?: number;
}

export function TourModal({
  isOpen,
  onClose,
  boardId,
  onPlayTour,
  isRecordingTour,
  onStartRecordingTour,
  onStopRecordingTour,
  recordingDuration = 0,
}: TourModalProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('Visite guidée du tableau');

  const fetchTours = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/tours`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTours(data.tours || []);
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les visites.');
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    if (isOpen) {
      fetchTours();
    }
  }, [isOpen, fetchTours]);

  const handleDelete = async (tourId: string) => {
    if (!confirm('Supprimer cette visite enregistrée ?')) return;
    try {
      const res = await fetch(`/api/boards/${boardId}/tours/${tourId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression.');
      setTours((prev) => prev.filter((t) => t.id !== tourId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStart = () => {
    onStartRecordingTour(newTitle.trim() || 'Visite guidée');
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-scale-in">
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
              <Video size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Visites commentées & Enregistrements
              </h2>
              <p className="text-[11px] text-slate-500">
                Enregistrez votre navigation sur le tableau et partagez-la
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          {/* Section Démarrer / Arrêter un enregistrement */}
          <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-purple-900 text-xs">
                {isRecordingTour ? 'Enregistrement en direct' : 'Nouvelle visite'}
              </span>
              {isRecordingTour && (
                <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span>{formatDuration(recordingDuration)}</span>
                </div>
              )}
            </div>

            {isRecordingTour ? (
              <div className="space-y-2">
                <p className="text-slate-600 text-[11px]">
                  Votre trajectoire de caméra et votre curseur sont en cours de capture.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onStopRecordingTour();
                    fetchTours();
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Radio size={14} className="animate-pulse" />
                  <span>Terminer et sauvegarder la visite</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Titre de la présentation
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Revue de sprint & Roadmap Q4"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Video size={14} />
                  <span>Démarrer la capture (Caméra & Curseur)</span>
                </button>
              </div>
            )}
          </div>

          {/* Liste des visites disponibles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
              <span>Visites disponibles ({tours.length})</span>
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 size={18} className="animate-spin text-purple-600" />
                <span>Chargement des visites...</span>
              </div>
            ) : tours.length === 0 ? (
              <div className="py-8 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-4">
                Aucune visite enregistrée pour ce tableau pour le moment.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {tours.map((tour) => (
                  <div
                    key={tour.id}
                    className="p-3 bg-white border border-slate-200 hover:border-purple-300 rounded-xl flex items-center justify-between gap-3 transition-colors shadow-2xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 truncate text-xs">
                        {tour.title}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {formatDuration(tour.duration)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {tour.creator?.name || 'Auteur inconnu'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onPlayTour(tour);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors"
                        title="Lire la visite"
                      >
                        <Play size={12} className="fill-white" />
                        <span>Lire</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tour.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
