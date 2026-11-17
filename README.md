# WASORIA CRM

CRM de WASORIA. Même modèle de données que le CRM de SIMATIS OS, pour communiquer avec l'instance WASORIA de l'OS ; synchronisation avec Odoo et serveurs MCP prévus.

> **Dépôt public** : code uniquement, aucune donnée réelle (voir [AGENTS.md](AGENTS.md)).

## Démarrer

Prérequis : Node 24, Docker (tests), un Postgres.

1. `cp .env.example .env` puis renseigner `DATABASE_URL` et `API_TOKEN` (`openssl rand -hex 24`).
2. `npm ci`, puis `npm run dev` (applique les migrations au démarrage).
3. `GET /health` pour vérifier.

## API

Toutes les routes, sauf `/health`, exigent `Authorization: Bearer <API_TOKEN>`.

| Ressource                   | Routes                                                        | Particularités                                                                                                   |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/entreprises`, `/contacts` | liste, lecture, création, modification (`PATCH`), suppression | filtres `q`, `entrepriseId`                                                                                      |
| `/affaires`                 | idem                                                          | chaque changement d'étape est daté (`etapesDates`) ; filtres `etape`, `ouvertes`                                 |
| `/taches`                   | idem + `POST /taches/:id/terminer`                            | le canal se déduit du type ; terminer met à jour la dernière activité de l'affaire ; filtres `ouvertes`, `avant` |
| `/rendez-vous`              | idem                                                          | un statut choisi ici passe le tri en `manuel` ; filtres `statut`, `depuis`, `jusqua`                             |
| `/activites`                | liste                                                         | historique d'une entreprise, d'un contact ou d'une affaire                                                       |

Listes paginées (`limite` jusqu'à 200, `decalage`). Une fiche créée ici est `natif` : `source` et `source_id` ne s'écrivent pas par l'API, seuls les connecteurs les posent. Supprimer une fiche encore liée répond 409.

`npm run verify` : format, lint, types, tests, build.

## Feuille de route

1. Socle : schéma des objets, migrations, API de santé (fait).
2. API CRM : entreprises, contacts, affaires, tâches, rendez-vous (fait). Reste : liens affaire ↔ contacts/entreprises, emails multiples, fusion.
3. Interface : accueil, pipe, comptes, fiche affaire, devis.
4. Connecteur Odoo (deux sens, double verrou).
5. Échange avec l'OS, profil `crm/1`.
6. Serveur MCP.
