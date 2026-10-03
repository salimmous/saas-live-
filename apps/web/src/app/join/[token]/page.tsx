'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Layers, ArrowRight, ShieldCheck, User } from 'lucide-react';

export default function JoinGuestPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/boards/join-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Lien invalide ou expiré');
        return;
      }

      // Stocker les identifiants invités dans sessionStorage
      sessionStorage.setItem(`guest_token_${data.boardId}`, data.guestToken);
      sessionStorage.setItem(`guest_name_${data.boardId}`, data.guestName);

      // Rediriger vers le tableau
      router.push(`/board/${data.boardId}?guestToken=${encodeURIComponent(data.guestToken)}&guestName=${encodeURIComponent(data.guestName)}`);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/25">
            <Layers size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Rejoindre le Tableau</h1>
          <p className="text-xs text-slate-400">
            Vous avez été invité à collaborer en direct sans avoir besoin de créer de compte.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Votre pseudonyme ou prénom
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="text"
                required
                autoFocus
                placeholder="Ex: Camille (Design)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>{loading ? 'Connexion en cours…' : 'Rejoindre l’espace de travail'}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Accès direct sécurisé par token chiffré</span>
        </div>
      </div>
    </div>
  );
}
