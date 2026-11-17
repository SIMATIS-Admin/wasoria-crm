# WASORIA CRM

CRM de WASORIA. Même modèle de données que le CRM de SIMATIS OS, pour communiquer avec l'instance WASORIA de l'OS ; synchronisation avec Odoo et serveurs MCP prévus.

> **Dépôt public** : code uniquement, aucune donnée réelle (voir [AGENTS.md](AGENTS.md)).

## Tester en local

Prérequis : Node 24 et Docker Desktop lancé.

1. `cp .env.example .env`, puis renseigner dans `.env` : `POSTGRES_PASSWORD` et `API_TOKEN` (`openssl rand -hex 24` chacun), `DB_PORT=5433`, et `DATABASE_URL=postgres://wasoria:<POSTGRES_PASSWORD>@localhost:5433/wasoria`.
2. `docker compose up -d` : démarre Postgres.
3. `npm ci`, puis `npm run demo:seed` : charge des données **fictives** (uniquement dans une base vide).
4. `npm run build`, puis `npm start`.
5. Ouvrir http://localhost:4400 et saisir `API_TOKEN` comme jeton d'accès.

Pour développer l'interface avec rechargement à chaud : `npm run dev` (API) et, dans un autre terminal, `npm run dev:web`, puis http://localhost:5173.

Ne jamais lancer `docker compose down -v` : le `-v` efface la base.

## Démarrer

Prérequis : Node 24, Docker (tests), un Postgres.

1. `cp .env.example .env` puis renseigner `DATABASE_URL` et `API_TOKEN` (`openssl rand -hex 24`).
2. `npm ci`, puis `npm run dev` (applique les migrations au démarrage).
3. `GET /health` pour vérifier.

## API

L'API vit sous `/api` ; toutes ses routes exigent `Authorization: Bearer <API_TOKEN>`.

| Ressource                   | Routes                                                        | Particularités                                                                                                   |
| --------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/entreprises`, `/contacts` | liste, lecture, création, modification (`PATCH`), suppression | filtres `q`, `entrepriseId`                                                                                      |
| `/affaires`                 | idem                                                          | chaque changement d'étape est daté (`etapesDates`) ; filtres `etape`, `ouvertes`                                 |
| `/taches`                   | idem + `POST /taches/:id/terminer`                            | le canal se déduit du type ; terminer met à jour la dernière activité de l'affaire ; filtres `ouvertes`, `avant` |
| `/rendez-vous`              | idem                                                          | un statut choisi ici passe le tri en `manuel` ; filtres `statut`, `depuis`, `jusqua`                             |
| `/activites`                | liste                                                         | historique d'une entreprise, d'un contact ou d'une affaire                                                       |

Listes paginées (`limite` jusqu'à 200, `decalage`). Une fiche créée ici est `natif` : `source` et `source_id` ne s'écrivent pas par l'API, seuls les connecteurs les posent. Supprimer une fiche encore liée répond 409.

`npm run verify` : format, lint, types, tests, build.

## Odoo

Synchronisation **Odoo → CRM, en lecture seule** : rien n'est jamais écrit dans Odoo. Elle copie les entreprises (partenaires « société ») et les contacts (personnes), rattachés à leur société.

- Configuration dans `.env` : `ODOO_URL` (https), `ODOO_API_KEY` (clé d'API d'un utilisateur Odoo), `ODOO_PROTOCOL` = `json2` (Odoo 19 et suivants) ou `jsonrpc` (Odoo 17 et 18, avec `ODOO_DB` et `ODOO_LOGIN`). Sans `ODOO_URL`, Odoo n'est pas branché.
- `npm run odoo -- verifier` teste les accès. `npm run odoo -- synchroniser` copie ce qui a changé depuis la dernière fois ; `--complet` relit tout. La même synchro se lance par `POST /api/odoo/synchro`.
- Règles (celles des connecteurs de l'OS) : une fiche est retrouvée par `source = 'odoo'` et son identifiant Odoo, mise à jour sans doublon ; une fiche disparue d'Odoo n'est pas effacée ; les fiches natives ne sont jamais touchées ; un champ vide dans Odoo vide la copie ; `ODOO_CHAMPS_EXCLUS` (ex. `contact.telephone`) retire des champs de la lecture comme de l'écriture.
- Correspondance : société → `entreprises` (`nom`, `ville`, `domaine` depuis le site web, `secteur` depuis le secteur d'activité) ; personne → `contacts` (`nom`, `fonction`, `email`, `telephone` = téléphone, à défaut mobile). Les adresses de facturation et de livraison ne sont pas copiées.
- Pas encore : affaires, tâches, rendez-vous, écriture vers Odoo (à ouvrir sous le double verrou `REAL_WRITES` après une première synchro vérifiée), devis. Les protocoles JSON-2 et JSON-RPC sont testés sur un faux Odoo : à confirmer sur l'instance réelle.

## Feuille de route

1. Socle : schéma des objets, migrations, API de santé (fait).
2. API CRM : entreprises, contacts, affaires, tâches, rendez-vous (fait). Reste : liens affaire ↔ contacts/entreprises, emails multiples, fusion.
3. Interface : accueil, pipe, fiche affaire, comptes, tâches, rendez-vous (fait). Reste : devis (avec Odoo).
4. Connecteur Odoo : comptes et contacts en lecture (fait). Reste : affaires, tâches, écriture sous double verrou, devis.
5. Échange avec l'OS, profil `crm/1`.
6. Serveur MCP.
