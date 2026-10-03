# Décisions Techniques d'Architecture (DECISIONS.md)

Ce document consigne l'ensemble des choix techniques, des arbitrages et de leurs justifications pour le développement du tableau blanc collaboratif.

---

## 1. Environnement d'Exécution & Monorepo

- **Monorepo :** `pnpm` workspaces avec TypeScript en mode strict (`strict: true`, `noImplicitAny: true`, etc.).
- **Découpage :**
  - `packages/shared` : Types TypeScript stricts, schémas Zod du modèle de tableau (`BoardElement`, opérations, actions IA), utilitaires géométriques, contrats d'API.
  - `apps/web` : Application Next.js 15 (App Router), React 19, Tailwind CSS v3/v4, Lucide icons, moteur de rendu canvas DOM+SVG.
  - `apps/sync` : Serveur Hocuspocus (Yjs CRDT over WebSocket) avec persistance PostgreSQL et authentification sécurisée par token.
- **Node & OS :** Node.js v25.9.0 sur macOS Darwin (arm64).
- **Base de données :** PostgreSQL 16 local (`postgresql://salim@localhost:5432/whiteboard`) pour le développement direct, avec schéma et client Prisma centralisé dans `packages/shared/prisma` ou partagé entre `apps/web` et `apps/sync`.

---

## 2. Rendu du Canvas : Moteur DOM + SVG Maison

- **Arbitrage :** Rejet des bibliothèques de canvas commerciales ou propriétaires (Konva, Fabric.js, Fabric-like).
- **Architecture :**
  - **Couche Monde Unique :** Un conteneur HTML avec transformation CSS 2D (`matrix` ou `translate3d(x, y, 0) scale(s)`) gérant le pan et le zoom avec accélération matérielle.
  - **SVG Dédié :** Utilisé pour les tracés libres (lissés par `perfect-freehand`), les connecteurs orthogonaux et courbes, les grilles et les indicateurs géométriques.
  - **DOM Natif :** Utilisé pour le texte riche éditable (`contenteditable` ou `textarea` contrôlés), les formulaires, sticky notes et cartes, garantissant une accessibilité optimale et la gestion native du focus et de la sélection.
  - **Culling Viewport :** Filtrage spatial (AABB - Axis-Aligned Bounding Box) pour ne monter / rendre que les éléments intersectant le viewport visible + une marge de sécurité (buffer de 200px).
  - **Performance :** Cible de 50+ FPS pour 500 objets, mémorisation React (`React.memo`), structure d'état normalisée.

---

## 3. Modèle de Données & Temps Réel (CRDT)

- **Yjs + Hocuspocus :**
  - La structure racine du tableau est un `Y.Doc` contenant une `Y.Map<BoardElement>` sous la clé `"elements"`.
  - Chaque élément possède un `id` stable (`nanoid`), un `type` parmi les types supportés, des coordonnées (`x`, `y`, `width`, `height`, `rotation`, `zIndex`), son `content`, son `style` et ses métadonnées.
  - `Y.UndoManager` configuré avec l'origine locale (`localOrigin`) pour que l'annulation/rétablissement n'annule que les modifications de l'utilisateur courant, sans affecter les modifications concurrentes des autres collaborateurs.
  - `y-indexeddb` côté client pour la tolérance aux pannes réseau et le mode hors-ligne : les modifications non synchronisées sont conservées localement et poussées dès reconnexion.
  - `Awareness` throttlé à ~20Hz (50ms) pour les curseurs només/colorés, sélections distantes et présence.

---

## 4. Authentification & Sécurité

- **Better Auth :** Authentification par email et mot de passe avec sessions en base PostgreSQL.
- **Rôles et permissions :**
  - Rôles : `owner`, `editor`, `reader`.
  - Liens invités : Token aléatoire chiffré/hashé (SHA-256) en base avec date d'expiration optionnelle et rôle (`reader` ou `editor`).
  - Validation temps réel dans Hocuspocus `onAuthenticate` : vérification du token de session ou du token d'invité, assignation de `readOnly = true` pour les lecteurs.
  - Révocation immédiate : la suppression d'un lien ou d'un droit déconnecte le WebSocket associé.

---

## 5. Stockage de Fichiers & Multimédia

- **Architecture S3 Provider :**
  - Interface abstraite `StorageProvider` (`put`, `getSignedUrl`, `delete`).
  - Implémentation compatible MinIO / AWS S3 via `@aws-sdk/client-s3` et `@aws-sdk/s3-request-presigner`.
  - Fallback local filesystem pour les environnements de développement sans conteneur Docker actif, garantissant une utilisation immédiate sans friction.
  - `VideoProvider` local V1 : stockage MinIO/local avec lecture native HTML5 vidéo (`<video>`) avec streaming range-request, plus intégration sandboxée pour YouTube et Vimeo.

---

## 6. Intégrations IA & Whisper

- **Architecture en couches :**
  - `AIProvider` abstrait avec implémentation Anthropic Claude SDK (modèle configurable via `ANTHROPIC_MODEL`, par défaut `claude-3-5-sonnet-20241022`).
  - Sorties structurées garanties par Zod (`zodToJsonSchema` / tool calling Anthropic).
  - `TranscriptionProvider` avec implémentation OpenAI Whisper API.
  - Protection contre les pannes et absences de clés : mode dégradé clair avec consignation dans `STATUS.md`.
  - Pipeline unifié d'opérations : Plan généré -> Validation Zod -> Vérification périmètre -> Ghost Preview client -> Transaction Yjs atomique.
