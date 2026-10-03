'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn, signUp } from '@/lib/auth-client';
import { Sparkles, Users, Layers, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('demo@whiteboard.local');
  const [password, setPassword] = useState('Password123!');
  const [name, setName] = useState('Utilisateur Démo');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirection si déjà connecté
  React.useEffect(() => {
    if (session?.user) {
      router.push('/dashboard');
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await signUp.email({
          email,
          password,
          name,
        });
        if (res.error) {
          setError(res.error.message || 'Erreur lors de l’inscription');
        } else {
          router.push('/dashboard');
        }
      } else {
        const res = await signIn.email({
          email,
          password,
        });
        if (res.error) {
          setError(res.error.message || 'Email ou mot de passe incorrect');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="px-6 py-5 border-b border-slate-800 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Layers className="text-white" size={22} />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Whiteboard
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
          <span className="hidden sm:inline text-slate-400">Compte démo inclus</span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setEmail('demo@whiteboard.local');
              setPassword('Password123!');
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Remplir démo
          </button>
        </div>
      </header>

      {/* Hero Section & Connexion */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 w-full">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Sparkles size={14} />
            <span>Tableau blanc collaboratif nouvelle génération</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Pensez, collaborez et concevez en temps réel.
          </h1>

          <p className="text-slate-400 text-base leading-relaxed">
            Créez des schémas, mind maps, notes adhésives et diagrammes synchronisés instantanément
            avec vos équipes, propulsé par l’intelligence artificielle.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <strong className="block text-white">Collaboration instantanée</strong>
                Curseurs nommés, présence et synchronisation CRDT Yjs.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <strong className="block text-white">Connecteurs intelligents</strong>
                Routage orthogonal évitant les obstacles et ancrage dynamique.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <strong className="block text-white">Accès invités sans compte</strong>
                Partage par lien lecteur ou éditeur révocable en direct.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <strong className="block text-white">Performance 50+ FPS</strong>
                Culling spatial du viewport supportant 500+ objets.
              </div>
            </div>
          </div>
        </div>

        {/* Boîte d'authentification */}
        <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">
              {isRegister ? 'Créer un compte' : 'Accéder à votre espace'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {isRegister
                ? 'Renseignez vos coordonnées pour démarrer'
                : 'Connectez-vous pour retrouver vos tableaux de bord'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Votre Nom</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  placeholder="Jean Dupont"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Adresse Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="nom@exemple.fr"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
            >
              <span>{loading ? 'Chargement…' : isRegister ? 'S’inscrire' : 'Se connecter'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              {isRegister
                ? 'Déjà inscrit ? Connectez-vous'
                : 'Pas encore de compte ? Créer un compte'}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-slate-800/80 text-center text-xs text-slate-500">
        Tableau Blanc Collaboratif &copy; 2026 — Conçu en TypeScript Strict, Next.js 15, Yjs CRDT & Hocuspocus.
      </footer>
    </div>
  );
}
