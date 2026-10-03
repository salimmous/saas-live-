# Tableau Blanc Collaboratif (Type Miro) — Temps Réel & IA

Application web de tableau blanc collaboratif inspirée de Miro, entièrement en français, ultra-performante et utilisable en production.

---

## 🌟 Fonctionnalités Clés

- **Canvas Infini Fluide (50+ FPS) :** Pan (espace + glisser, molette, trackpad), zoom centré sur curseur (10% à 400%), centrage automatique « Ajuster au contenu », et minimap interactive avec cadrage dynamique.
- **Rendu Hybride Haute Performance (DOM + SVG) :**
  - Moteur maison sans dépendance propriétaire lourde.
  - Culling spatial AABB pour fluidité absolue même avec 500+ objets simultanés.
  - Textes et notes éditables directement dans le DOM natif, tracés libres et connecteurs en SVG vectoriel.
- **Objets Riches :** Sticky notes multicolores, textes typographiques, formes géométriques (rectangles, cercles, losanges, étoiles, triangles), dessin libre au stylet lissé avec `perfect-freehand`, cadres (frames), mind map nodes, cartes de tâches, liens web avec aperçus, médias vidéo et images.
- **Connecteurs Intelligents :** Routage orthogonal évitant les collisions, points d'ancrage automatiques, flèches configurables, libellés éditables au centre et nettoyage automatique lors de la suppression des objets reliés.
- **Collaboration Temps Réel (CRDT Yjs + Hocuspocus) :**
  - Synchronisation sans conflit avec persistance PostgreSQL.
  - Curseurs distants nommés et colorés avec diffusion throttlée (~20Hz).
  - Présence et sélections distantes en direct.
  - Résilience aux pannes réseau : `y-indexeddb` conserve les modifications locales et resynchronise automatiquement dès reconnexion.
  - Annulation locale : `UndoManager` Yjs restreint à l'origine locale (`localOrigin`) pour n'annuler que ses propres actions sans écraser celles des collaborateurs.
- **Partage & Sécurité (Accès Invité Révocable) :**
  - Tableaux privés par défaut avec gestion des rôles (`owner`, `editor`, `reader`).
  - Liens d'accès invités avec tokens aléatoires chiffrés (SHA-256) en base de données.
  - Rejoindre en 1 clic sans créer de compte (nom invité en session).
  - Révocation instantanée : la révocation d'un lien ferme immédiatement les connexions WebSocket actives.
- **Export & Raccourcis :** Export PNG haute définition du tableau, aide complète des raccourcis clavier via `?`.

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js >= 20.x
- pnpm >= 9.x
- PostgreSQL

### 1. Installation des dépendances
```bash
pnpm install
```

### 2. Configuration des variables d'environnement
Copiez `.env.example` vers `.env` et adaptez les valeurs si besoin :
```bash
cp .env.example .env
```

### 3. Base de données et Seed
```bash
# Générer le client Prisma et synchroniser le schéma
pnpm --filter @whiteboard/shared db:generate
pnpm --filter @whiteboard/shared db:push

# Lancer le seed (crée l'utilisateur démo et le tableau avec 500 objets)
pnpm --filter @whiteboard/shared db:seed
```

**Identifiants du compte Démo :**
- **Email :** `demo@whiteboard.local`
- **Mot de passe :** `Password123!`

### 4. Lancement en développement
```bash
# Lancer simultanément l'application Web et le serveur temps réel
pnpm dev

# Ou individuellement :
pnpm dev:web   # http://localhost:3000
pnpm dev:sync  # ws://localhost:1234
```

---

## ☁️ Déploiement sur Vercel

Pour déployer l'application sur Vercel :

1. Connectez votre dépôt GitHub à **Vercel**.
2. **Paramètres du Projet (Build & Development Settings) :**
   - **Framework Preset :** Next.js
   - **Root Directory :** `./` (ou `apps/web`)
   - **Build Command :** `pnpm --filter @whiteboard/shared db:generate && pnpm --filter web build`
   - **Output Directory :** `apps/web/.next` (si exécuté depuis la racine)
3. **Variables d'Environnement sur Vercel :**
   - `DATABASE_URL` : Votre URL PostgreSQL (Supabase, Neon, Railway, AWS RDS, etc.)
   - `BETTER_AUTH_SECRET` : Secret aléatoire de 32 caractères minimum
   - `BETTER_AUTH_URL` : URL de votre déploiement Vercel (ex: `https://votre-domaine.vercel.app`)
   - `NEXT_PUBLIC_APP_URL` : URL publique de votre app
   - `NEXT_PUBLIC_SYNC_URL` : URL WebSocket de votre serveur Hocuspocus (Railway, Render, Fly.io, etc.)
   - `ANTHROPIC_API_KEY` : Clé Anthropic Claude (optionnelle pour l'IA)
   - `OPENAI_API_KEY` : Clé OpenAI (optionnelle pour Whisper)

---

## 🧪 Tests et Qualité de Code

```bash
# Tests unitaires et intégration (Vitest)
pnpm test

# Vérification stricte des types TypeScript
pnpm typecheck

# Linting
pnpm lint
```

---

## 📁 Architecture du Monorepo

```
├── apps/
│   ├── web/          # Next.js 15 (App Router), React 19, Tailwind CSS, Canvas DOM+SVG
│   └── sync/         # Serveur temps réel Hocuspocus (Yjs CRDT) & persistance PostgreSQL
├── packages/
│   └── shared/       # Schéma Prisma, types stricts, schémas Zod, géométrie & algorithmes
├── tests/            # Suite de tests Vitest (connecteurs, culling, schémas, sécurité)
├── DECISIONS.md      # Choix d'architecture techniques documentés
├── STATUS.md         # État d'avancement des 20 fonctionnalités et des phases
└── docker-compose.yml # Configuration Docker multi-services (Postgres, MinIO, Web, Sync)
```
