# WASORIA CRM

CRM de WASORIA. Même modèle de données que le CRM de SIMATIS OS, pour communiquer avec l'instance WASORIA de l'OS ; synchronisation avec Odoo et serveurs MCP prévus.

> **Dépôt public** : code uniquement, aucune donnée réelle (voir [AGENTS.md](AGENTS.md)).

## Démarrer

Prérequis : Node 24, Docker (tests), un Postgres.

1. `cp .env.example .env` puis renseigner `DATABASE_URL`.
2. `npm ci`, puis `npm run dev` (applique les migrations au démarrage).
3. `GET /health` pour vérifier.

`npm run verify` : format, lint, types, tests, build.

## Feuille de route

1. Socle : schéma des objets, migrations, API de santé (fait).
2. API CRM : entreprises, contacts, affaires, tâches, rendez-vous.
3. Interface : accueil, pipe, comptes, fiche affaire, devis.
4. Connecteur Odoo (deux sens, double verrou).
5. Échange avec l'OS, profil `crm/1`.
6. Serveur MCP.
