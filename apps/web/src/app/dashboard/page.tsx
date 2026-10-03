'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import {
  Layers,
  Plus,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  Edit2,
  LogOut,
  Calendar,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

interface BoardItem {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  userRole?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [sharedBoards, setSharedBoards] = useState<BoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Édition de titre
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Menu déroulant actif
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Redirection si déconnecté
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/');
    }
  }, [isPending, session, router]);

  // Charger les tableaux
  const fetchBoards = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data.owned || []);
        setSharedBoards(data.shared || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchBoards();
    }
  }, [session]);

  // Créer un nouveau tableau
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newBoardTitle.trim() || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsCreating(false);
        setNewBoardTitle('');
        router.push(`/board/${data.board.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Dupliquer un tableau
  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/boards/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        await fetchBoards();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Renommer un tableau
  const handleStartRename = (board: BoardItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    setEditingBoardId(board.id);
    setEditingTitle(board.title);
  };

  const handleSaveRename = async (id: string) => {
    if (!editingTitle.trim()) {
      setEditingBoardId(null);
      return;
    }
    try {
      await fetch(`/api/boards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      setEditingBoardId(null);
      await fetchBoards();
    } catch (err) {
      console.error(err);
    }
  };

  // Supprimer un tableau
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId(null);
    if (!window.confirm('Voulez-vous vraiment supprimer définitivement ce tableau ?')) return;

    try {
      await fetch(`/api/boards/${id}`, { method: 'DELETE' });
      await fetchBoards();
    } catch (err) {
      console.error(err);
    }
  };

  // Filtrage par recherche
  const filteredOwned = boards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredShared = sharedBoards.filter((b) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barre supérieure du Dashboard */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-slate-800 tracking-tight leading-tight">
              Tableaux de bord
            </h1>
            <p className="text-xs text-slate-400">Espace de travail collaboratif</p>
          </div>
        </div>

        {/* Profil & Déconnexion */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-800">{session?.user?.name}</span>
            <span className="text-[11px] text-slate-400">{session?.user?.email}</span>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
            className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Se déconnecter"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 space-y-8">
        {/* Barre d'action : Recherche + Nouveau Tableau */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher un tableau…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 shadow-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={16} />
            <span>Nouveau Tableau</span>
          </button>
        </div>

        {/* Modale / Champ de création rapide de tableau */}
        {isCreating && (
          <form
            onSubmit={handleCreateBoard}
            className="p-4 bg-white border border-blue-200 rounded-2xl shadow-sm flex items-center gap-3 animate-scale-in"
          >
            <input
              type="text"
              autoFocus
              placeholder="Titre du tableau (ex: Roadmap Produit 2026)…"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              className="flex-1 text-sm font-medium outline-none text-slate-800"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 text-xs font-medium"
            >
              Annuler
            </button>
          </form>
        )}

        {/* Section Mes Tableaux */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <LayoutGrid size={16} className="text-slate-400" />
              <span>Mes Tableaux ({filteredOwned.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 bg-slate-200/60 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredOwned.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
                <Layers size={24} />
              </div>
              <h3 className="font-bold text-slate-700 text-sm">Aucun tableau trouvé</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Aucun résultat ne correspond à votre recherche.'
                  : 'Commencez par créer votre premier tableau blanc collaboratif.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredOwned.map((board) => {
                const isDemo500 = board.title.includes('500');

                return (
                  <div
                    key={board.id}
                    className="relative group bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-400 transition-all flex flex-col justify-between"
                  >
                    <Link
                      href={`/board/${board.id}`}
                      className="p-5 flex-1 flex flex-col justify-between min-h-[140px]"
                    >
                      <div>
                        {isDemo500 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold uppercase mb-2">
                            <Sparkles size={11} />
                            <span>Démo 500 Objets</span>
                          </span>
                        )}

                        {editingBoardId === board.id ? (
                          <div
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className="flex items-center gap-1"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleSaveRename(board.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(board.id)}
                              className="w-full text-sm font-bold text-slate-800 border-b-2 border-blue-500 outline-none pb-0.5"
                            />
                          </div>
                        ) : (
                          <h3 className="font-bold text-slate-800 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {board.title}
                          </h3>
                        )}

                        {board.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                            {board.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100 mt-4">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {new Date(board.updatedAt).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="font-semibold text-slate-500">Propriétaire</span>
                      </div>
                    </Link>

                    {/* Menu contextuel du tableau (Renommer, Dupliquer, Supprimer) */}
                    <div className="absolute top-3 right-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === board.id ? null : board.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {activeMenuId === board.id && (
                        <div
                          className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-slate-200 py-1 w-36 z-30 animate-scale-in"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(board, e)}
                            className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Edit2 size={13} />
                            <span>Renommer</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(board.id, e)}
                            className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Copy size={13} />
                            <span>Dupliquer</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(board.id, e)}
                            className="w-full px-3 py-1.5 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                          >
                            <Trash2 size={13} />
                            <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section Tableaux Partagés */}
        {filteredShared.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Partagés avec moi ({filteredShared.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredShared.map((board) => (
                <Link
                  key={board.id}
                  href={`/board/${board.id}`}
                  className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:shadow-lg hover:border-blue-400 transition-all flex flex-col justify-between min-h-[140px]"
                >
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-2">
                      {board.title}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                    <span>{new Date(board.updatedAt).toLocaleDateString('fr-FR')}</span>
                    <span className="font-semibold text-blue-600 capitalize">
                      {board.userRole === 'editor' ? 'Éditeur' : 'Lecteur'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
