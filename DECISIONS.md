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

---

## 7. Mind Maps & Organisation Automatique (Phase 2)

- **Structure d'arbre Mind Map :**
  - Relations hiérarchiques représentées par `parentId` et index `order` sur le type `mindmap-node`.
  - Ergonomie clavier fluide : `Tab` pour créer instantanément un nœud enfant connecté, `Enter` pour créer un nœud frère au même niveau.
  - Bascule de masquage / dépliage : attribut `collapsed: boolean` permettant de replier les sous-arbres volumineux pour aérer la lecture.
- **Moteur d'Auto-Layout Hybride :**
  - Moteur Dagre pour les graphes dirigés et hiérarchies d'arbres (espacement `ranksep: 80`, `nodesep: 50`).
  - Moteur Grille adaptatif pour les collections d'objets sans relation parent-enfant (colonnes régulières de 4 éléments).
- **Contrôle Strict de Portée IA (Scope Validation) :**
  - `validatePlanScope` rejette côté serveur et client toute mutation d'élément en dehors des IDs explicitement sélectionnés lorsque le périmètre est restreint à la sélection (`scope: { type: 'selection', targetIds }`).
- **Import de Documents & Traçabilité :**
  - Support de TXT, Word DOCX (via `mammoth`) et PDF textuel (via `unpdf`) convertis au choix en Mind Map radiale, Frise chronologique (timeline) ou Plan en colonnes hiérarchiques.
  - Chaque élément généré conserve la mention d'origine via `meta.sourceDocRef: "Source: <nom_du_fichier>"`.

---

## 8. Ateliers, Médias Riches & Partage (Phase 3)

- **Confidentialité & Décompte des Votes (Feature 13) :**
  - Les votes sont enregistrés en base PostgreSQL (`Vote` et `VoteSession`) via transactions Prisma garantissant l'atomicité et le respect du plafond de votes par utilisateur (`votesPerUser`).
  - Pendant qu'une session est active, les décomptes globaux restent masqués : chaque participant ne voit que ses propres votes. À la clôture, le serveur calcule et expose le classement et le podium.
- **Brainstorming Privé Étéanche (Feature 14) :**
  - Pour garantir que les brouillons restent strictement privés et invisibles dans les flux réseau WebSocket ou les inspecteurs DOM, ils sont isolés dans la table PostgreSQL `BrainstormDraft` et ne transitent jamais par Yjs ou l'Awareness.
  - La révélation ("Révéler toutes mes idées") marque les brouillons comme révélés en base et les insère en une transaction Yjs unique sur le tableau partagé.
- **Sécurité Médias & Prévention SSRF (Feature 16) :**
  - Téléversement direct multipart vérifié (MIME types stricts, quotas de 10 Mo pour images et 50 Mo pour vidéos) stocké via `StorageProvider` avec URL signée HMAC.
  - L'endpoint `/api/link-preview` intègre une barrière SSRF complète : rejet des noms d'hôtes locaux (`localhost`, `.local`, `.internal`), des adresses de bouclage (`127.0.0.1`, `::1`), des plages privées RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) et de l'IP de métadonnées cloud AWS/GCP (`169.254.169.254`).
- **Présentation Animée (Feature 12) & Prototypes Cliquables (Feature 20) :**
  - Les cadres (`frame`) définissent les diapositives avec transition de caméra interpolée vers les coordonnées de cadre.
  - Les zones interactives (`hotspot`) permettent de prototyper des parcours applicatifs en sautant d'un cadre à un autre au clic en mode prototype.

---

## 9. Fonctions Avancées (Phase 4)

- **Croquis vers Diagramme (Feature 5) :**
  - Modèle multimodal Claude 3.5 Sonnet avec extraction géométrique précise (rectangles, cercles, losanges de décision, flèches étiquetées) et score de confiance normalisé (0.0 à 1.0).
  - Mode dégradé local garantissant une conversion immédiate et déterministe même en l'absence de clé API Anthropic.
  - Plan d'opérations prévisualisable avec ghost preview et insertion atomique sur le canvas.
- **Voix vers Sticky Notes (Feature 9) :**
  - Enregistrement audio haute-fidélité via WebRTC MediaRecorder (`audio/webm`), transcription via OpenAI Whisper API (`model: whisper-1`).
  - Découpage sémantique du discours en idées unitaires formatées en notes adhésives distribuées en quadrillage régulier sur le canvas.
  - Repli local déterministe en français sans clé API OpenAI pour test et démonstration immédiate.
- **Visites Commentées Enregistrées (Feature 18) :**
  - Capture en flux continu (échantillonnage 100ms) de la trajectoire de caméra (`viewport.x`, `viewport.y`, `viewport.zoom`) et de la position du pointeur de souris du présentateur.
  - Stockage persistant dans la table PostgreSQL `RecordedTour` avec durée, auteur et métadonnées.
  - Lecteur synchrone intégré (`TourPlayerOverlay`) avec boucle `requestAnimationFrame`, curseur virtuel en direct, scrubber interactif et sélecteur de vitesse (1x, 1.5x, 2x).
- **Historique & Replay (Feature 19) :**
  - Points de sauvegarde manuels et automatiques archivés dans la table PostgreSQL `BoardSnapshot`.
  - Incrément séquentiel de version (`schemaVersion`), horodatage précis et traçabilité de l'auteur.
  - Restauration atomique restaurant l'état exact du tableau blanc en une seule transaction.

---

## 10. Déploiement Production & Vercel Monorepo

- **Déploiement Vercel :**
  - Projet Vercel : `saas-live-gvkv` relié au repository GitHub `https://github.com/salimmous/saas-live-.git`.
  - Configuration du monorepo via `vercel.json` à la racine : commande de build personnalisée `pnpm --filter @whiteboard/shared run db:generate && pnpm --filter @whiteboard/shared run build && pnpm --filter web run build` et `outputDirectory: "apps/web/.next"`.
  - Isolation des Dockerfiles dans `docker/` (`docker/sync.Dockerfile` et `docker/web.Dockerfile`) et ajout de `.vercelignore` afin d'éviter toute détection erronée de conteneur Vercel (`buildah`).
- **Correction Sécurité Next.js (CVE-2025-66478) :**
  - Montée de version de Next.js vers la version sécurisée officielle `15.5.27` avec `eslint-config-next: 15.5.27`, résolvant le blocage de sécurité lors du build Vercel.
  - Déploiement vérifié avec succès en production : `https://saas-live-gvkv.vercel.app` (HTTP 200).

---

## 11. Réunion Meet Intégrée (Audio, Vidéo, Salle d'Attente & Modération Hôte)

- **Flux Caméra & Voix WebRTC :**
  - Capture directe via `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` avec bascule dégradée audio seul et simulation tolérante aux pannes sans périphériques.
  - Rendu par bulles vidéo flottantes en superposition sur le tableau blanc avec indicateur d'activité vocale dynamique.
  - Partage d'écran en direct via `getDisplayMedia`.
- **Salle d'Attente & Demandes d'Entrée ("Knock") :**
  - Tout invité rejoignant via le lien Meet est placé en salle d'attente sécurisée tant que l'hôte n'a pas validé son entrée.
  - L'hôte reçoit une alerte instantanée avec les boutons `[Autoriser]` et `[Refuser]`.
- **Contrôle & Modération par l'Hôte :**
  - Panneau de gestion des participants permettant à l'hôte d'ajuster individuellement ou globalement :
    - 🎤 Forcer le silence / autoriser le micro (`isMutedByHost`).
    - 📹 Bloquer / autoriser le flux vidéo (`isVideoBlockedByHost`).
    - ✏️ Accorder le droit d'écriture sur le tableau ou basculer en lecture seule (`canDraw`).
    - 🚫 Expulser un participant de la réunion.
- **Résilience Réseau & Synchronisation :**
  - Statut de synchronisation transparent privilégiant la persistance locale IndexedDB sans afficher d'erreurs intempestives.
  - Signalisation et heartbeat temps réel via `/api/boards/[id]/meet`.

