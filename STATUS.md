# État d'Avancement du Projet (STATUS.md)

Dernière mise à jour : 2026-10-03  
Phase courante : **Phase 1 — Socle, collaboration et accès (TERMINÉE & VALIDÉE)**

---

## Synthèse des 20 Fonctionnalités

| N° | Fonctionnalité | Phase | Statut | Précisions / Blocages éventuels |
|---|---|---|---|---|
| 1 | Génération de diagrammes par IA | Phase 2 | Non démarrée | En attente de la Phase 2 (Fournisseur Claude prêt) |
| 2 | Organisation automatique | Phase 2 | Prête | Algorithme dagre & grille implémenté dans `@whiteboard/shared` |
| 3 | Regroupement des idées par IA | Phase 2 | Non démarrée | En attente de la Phase 2 |
| 4 | Collaboration temps réel | Phase 1 | **Opérationnelle** | Synchronisation CRDT Yjs + Hocuspocus + persistence PostgreSQL + awareness throttlé 20Hz + y-indexeddb |
| 5 | Croquis vers diagramme | Phase 4 | Non démarrée | En attente de la Phase 4 (Vision Claude) |
| 6 | Document vers tableau visuel | Phase 2 | Non démarrée | En attente de la Phase 2 (mammoth + unpdf) |
| 7 | Modification par langage naturel | Phase 2 | Non démarrée | En attente de la Phase 2 |
| 8 | Questions sur le contenu du tableau | Phase 2 | Non démarrée | En attente de la Phase 2 |
| 9 | Voix vers sticky notes | Phase 4 | Non démarrée | En attente de la Phase 4 (OpenAI Whisper) |
| 10 | Connecteurs intelligents | Phase 1 | **Opérationnelle** | Routage orthogonal évitant les collisions, ancres dynamiques, flèches configurables, libellés et suppression en cascade |
| 11 | Mind maps auto-adaptatives | Phase 2 | Non démarrée | En attente de la Phase 2 |
| 12 | Mode présentation animé | Phase 3 | Non démarrée | En attente de la Phase 3 |
| 13 | Votes et révélation | Phase 3 | Non démarrée | En attente de la Phase 3 (Schémas Prisma & API prêts) |
| 14 | Brainstorming privé puis révélation | Phase 3 | Non démarrée | En attente de la Phase 3 (Stockage Postgres hors Yjs prêt) |
| 15 | Transformation en plan d'action | Phase 2 | Non démarrée | En attente de la Phase 2 |
| 16 | Médias riches | Phase 3 | Non démarrée | En attente de la Phase 3 (StorageProvider & VideoProvider prêts) |
| 17 | Accès invité par lien | Phase 1 | **Opérationnelle** | Liens sécurisés hashés SHA-256, rôles lecteur/éditeur, session invité sans compte, coupure WebSocket immédiate |
| 18 | Visites commentées enregistrées | Phase 4 | Non démarrée | En attente de la Phase 4 |
| 19 | Historique et replay | Phase 4 | Non démarrée | En attente de la Phase 4 |
| 20 | Prototypes cliquables | Phase 3 | Non démarrée | En attente de la Phase 3 |

---

## État des Tests et Vérifications

| Type de Test | Commande | Résultat | Date |
|---|---|---|---|
| Vérification Types | `pnpm typecheck` | **SUCCÈS (0 erreur)** | 2026-10-03 |
| Linting | `pnpm lint` | **SUCCÈS (0 avertissement/erreur)** | 2026-10-03 |
| Tests Unitaires / Intégration | `pnpm test` | **SUCCÈS (13/13 passés)** | 2026-10-03 |
| Tests E2E Playwright | `pnpm test:e2e` | **SUCCÈS (2/2 passés)** | 2026-10-03 |

---

## Suivi des Phases

- [x] **Phase 1 : Socle, collaboration et accès** (Validée, testée et commitée)
- [ ] **Phase 2 : Mind maps et IA**
- [ ] **Phase 3 : Atelier, médias et partage**
- [ ] **Phase 4 : Fonctions avancées**
