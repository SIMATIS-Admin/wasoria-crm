# WASORIA CRM

CRM de WASORIA. Même modèle de données que le CRM de SIMATIS OS, pour communiquer avec l'instance WASORIA de l'OS ; synchronisation avec Odoo et serveurs MCP prévus.

> **Dépôt public** : code uniquement, aucune donnée réelle (voir [AGENTS.md](AGENTS.md)).

## Tester en local

Prérequis : Node 24 et Docker Desktop lancé.

1. `cp .env.example .env`, puis renseigner dans `.env` : `POSTGRES_PASSWORD` et `API_TOKEN` (`openssl rand -hex 24` chacun), `DB_PORT=5433`, et `DATABASE_URL=postgres://wasoria:<POSTGRES_PASSWORD>@localhost:5433/wasoria`.
2. `docker compose up -d` : démarre Postgres.
3. `npm ci`, puis `npm run demo:seed` : charge des données **fictives** (uniquement dans une base vide).
4. `npm run build`, puis `npm start`.
5. Ouvrir http://localhost:4400. À la toute première visite, la page propose de **créer le premier compte** : saisir `API_TOKEN` (ligne du fichier `.env`, c'est la clé d'installation), un nom, un identifiant et un mot de passe de 12 caractères au moins. Ensuite, on se connecte par identifiant et mot de passe.

Pour développer l'interface avec rechargement à chaud : `npm run dev` (API) et, dans un autre terminal, `npm run dev:web`, puis http://localhost:5173.

Ne jamais lancer `docker compose down -v` : le `-v` efface la base.

## Démarrer

Prérequis : Node 24, Docker (tests), un Postgres.

1. `cp .env.example .env` puis renseigner `DATABASE_URL` et `API_TOKEN` (`openssl rand -hex 24`).
2. `npm ci`, puis `npm run dev` (applique les migrations au démarrage).
3. `GET /health` pour vérifier.

## API

L'API vit sous `/api`. Ses routes exigent soit une session ouverte par l'interface (cookie), soit `Authorization: Bearer <API_TOKEN>` pour les intégrations (connecteur de l'OS, scripts).

## Devis

Un devis se prépare depuis la fiche d'une affaire (« Préparer un devis ») et se retrouve dans l'écran **Devis**. Il pioche ses lignes dans le **catalogue d'articles** (Réglages > Articles : référence, nom, prix HT, « une fois » ou « chaque année »), et peut se faire de deux façons :

- **Achat** : l'investissement (lignes payées une fois), les services annuels (lignes facturées chaque année) et le total de la première année ;
- **Abonnement** : l'investissement est financé (taux réglable, 4 % au départ, sur 36, 48 ou 60 mois) et les services annuels sont lissés : une mensualité, le coût du financement, le total sur la durée.

Chaque ligne garde une copie du nom et du prix au moment du devis : changer un prix du catalogue ne modifie pas un devis déjà fait. Prix négociable ligne par ligne via l'API. Le numéro est `D-<année>-<rang>`. Le devis suit un cycle (brouillon, envoyé, accepté ou refusé) ; envoyé, il ne se modifie plus sans repasser en brouillon. L'aperçu à droite s'imprime tel quel (**Imprimer / PDF**). Qui peut quoi : un commercial prépare et modifie, seuls les administrateurs règlent le catalogue et suppriment ; le rôle après-vente suit ses droits sur les affaires.

Pas encore : le lien avec Odoo (articles et prix lus dans Odoo, devis accepté qui devient une commande Odoo), l'envoi par email, la TVA et les conditions de paiement. Les articles de démonstration sont fictifs.

## Après-vente

Deux pipes : **Vente** (celui que partage l'OS) et **Après-vente** (installation, mise en service, suivi et maintien en conditions opérationnelles, renouvellement : étapes de départ à adapter dans l'écran « Étapes », un onglet par pipe). L'écran Pipe a un onglet par pipe.

- Une affaire appartient à un pipe, choisi à la création et jamais changé ; son étape doit être une étape de ce pipe. Supprimer une étape déplace ses affaires vers une étape **du même pipe**.
- Une **vente gagnée** ouvre un dossier après-vente (bouton « Créer le dossier après-vente » sur la fiche, ou `POST /api/affaires/:id/apres-vente`) : même compte, mêmes contacts, première étape du pipe après-vente, lien vers la vente d'origine. Un seul dossier par vente. On peut aussi créer un dossier seul.
- Rôle **Après-vente** : comme un commercial, mais il ne crée ni ne modifie que les affaires du pipe après-vente (il lit tout le reste) ; il ouvre le pipe Après-vente par défaut.
- **L'OS ne voit que la vente** : l'API d'échange et l'indicateur « opportunités entrantes » ignorent les dossiers après-vente. L'après-vente se suit ici seulement.
- Pas encore : parc d'équipements installés, dates de visite de suivi et contrat de maintenance en champs dédiés, indicateurs propres à l'après-vente, second cerveau partagé avec l'après-vente. Le cahier des charges marque ce besoin « à confirmer » : le modèle (un second pipe de dossiers, ouvert depuis une vente gagnée) est à valider avec WASORIA.

## Indicateurs du cycle de vente

Chaque changement d'étape d'une affaire est daté automatiquement (`etapesDates`), de même que sa clôture gagnée ou perdue (`closLe`). L'écran **Indicateurs** en tire, sur 30 à 365 jours :

- des **délais** (médiane et moyenne, en jours) entre l'arrivée dans deux étapes, ou jusqu'à la commande : par défaut la remise du devis et la première réponse ;
- des **conversions** (part des affaires entrées dans une étape qui ont atteint une autre, ou la commande) : par défaut du contact à la visite et du devis à la commande ;
- les **opportunités entrantes par semaine** (affaires créées).

Les étapes de départ et d'arrivée et les objectifs se règlent par indicateur (bouton « Régler »). Les réglages de départ sont des hypothèses à valider avec WASORIA : quelles étapes marquent le contact, la visite, le devis. Supprimer une étape qui servait à un indicateur le remet « à configurer ». Les affaires qui n'ont pas franchi les deux étapes ne comptent pas dans un délai ; dans une conversion, celles qui n'ont pas (encore) atteint l'étape d'arrivée comptent comme non converties. Si une affaire repasse par une étape, c'est la dernière arrivée qui est retenue.

Pour donner un parcours daté aux affaires de démonstration déjà chargées : `npm run demo:seed -- --historique`.

## Comptes et connexion

- Connexion par identifiant et mot de passe. Le mot de passe n'est jamais stocké, seulement son empreinte (scrypt, avec sel) ; la session est un cookie `HttpOnly`, `SameSite=Strict` (et `Secure` en https), valable 7 jours d'activité ; la base ne garde que l'empreinte du jeton de session.
- Après 5 échecs sur un même compte depuis une même adresse, la connexion est bloquée 15 minutes. Un identifiant inconnu et un mauvais mot de passe reçoivent la même réponse.
- **Trois rôles** :

  | Rôle           | Peut                                                                                                                                          |
  | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
  | Administrateur | tout : supprimer des fiches, régler les étapes et les indicateurs, lancer la synchro Odoo, gérer les comptes                                  |
  | Commercial     | consulter, créer et modifier les fiches (entreprises, contacts, affaires, tâches, rendez-vous, notes, liens) ; ne supprime pas, ne règle rien |
  | Lecture seule  | consulter tout, ne modifier rien                                                                                                              |

  Le premier compte créé à l'installation est administrateur ; les comptes existants avant l'arrivée des rôles le sont devenus. Les droits sont vérifiés par le serveur à chaque appel (l'interface masque seulement ce qui serait refusé). Changer le rôle d'un compte ferme ses sessions : la personne se reconnecte avec ses nouveaux droits. Il reste toujours un administrateur actif, et on ne désactive pas son propre compte.

- **Écran Équipe** (administrateurs) : créer un compte avec son rôle, changer un rôle, désactiver ou réactiver, réinitialiser un mot de passe. **Mon compte** (clic sur son nom, en haut) : changer son propre mot de passe, avec l'actuel ; ses autres sessions se ferment.
- Le jeton `API_TOKEN` des intégrations (OS, scripts) lit et écrit les données, mais ne gère pas les comptes.
- En ligne de commande : `npm run utilisateur -- creer <identifiant> --nom "Nom" --role admin|commercial|lecture`, `role <identifiant> <role>`, `mot-de-passe <identifiant>` (ferme ses sessions), `desactiver <identifiant>`, `activer <identifiant>`, `lister`.
- Derrière un proxy https, mettre `TRUST_PROXY=on` pour le cookie `Secure` et l'adresse réelle du client.

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

## Échange avec SIMATIS OS

Le CRM de WASORIA fait foi ; l'instance WASORIA de l'OS en garde une copie de travail, par un **connecteur côté OS** (même principe que HubSpot, voir `docs/AJOUTER-UN-CRM.md` de l'OS). Ce dépôt fournit ce que le connecteur lit et écrit, avec le même jeton que le reste de l'API.

**Lire (`sync`)**, en champs du profil `crm/1` (snake_case, mêmes noms que l'OS) :

| Route                                                                      | Contenu                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/echange`                                                         | profil (`crm/1`), objets disponibles, heure du serveur                                                                                                                                     |
| `GET /api/echange/etapes`                                                  | étapes du pipeline (`id`, `label`, `ordre`, `clos`, `gagne`, `probabilite`)                                                                                                                |
| `GET /api/echange/{entreprise,contact,affaire,tache,rendez_vous,activite}` | `{ id, source, source_id, modifie_le, champs, liens }` ; `?depuis=<date ISO>` relit ce qui a changé (borne incluse), `limite` (≤ 500) et `decalage` paginent du plus ancien au plus récent |
| `GET /api/echange/suppressions?depuis=`                                    | fiches supprimées ici : l'OS ne les efface pas, il les signale                                                                                                                             |

Un lien modifié fait remonter la fiche qu'il décrit (`modifie_le`). Les rendez-vous partagés sont ceux classés `rdv` et datés. L'`id` de chaque fiche est son identifiant ici : c'est le `source_id` que le connecteur retient côté OS.

**Écrire (`write`)** : les opérations de l'OS passent par les routes du CRM (corps en camelCase, comme le reste de l'API).

| Opération de l'OS                               | Route                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `company.create` / `company.update`             | `POST /api/entreprises` / `PATCH /api/entreprises/:id`                                                                                                                      |
| `contact.create` / `contact.update`             | `POST /api/contacts` / `PATCH /api/contacts/:id`                                                                                                                            |
| `deal.create` / `deal.update` / `deal.stage`    | `POST /api/affaires` / `PATCH /api/affaires/:id` (`{ "etape": … }` pour l'étape, datée automatiquement)                                                                     |
| `deal.associer`, `association.add` / `.remove`  | `PUT /api/affaires/:id/liens`, `PUT /api/contacts/:id/liens`, `PUT /api/rendez-vous/:id/liens` : la liste complète du lien remplace l'ancienne, le premier est le principal |
| emails d'un contact                             | `PUT /api/contacts/:id/emails` (le premier est l'adresse principale)                                                                                                        |
| `task.create` / `task.update` / `task.complete` | `POST /api/taches` / `PATCH /api/taches/:id` / `POST /api/taches/:id/terminer`                                                                                              |
| `note.create`                                   | `POST /api/activites`                                                                                                                                                       |
| `record.archive`                                | `DELETE` de la fiche, journalisé dans `suppressions`                                                                                                                        |
| `record.merge`                                  | pas encore                                                                                                                                                                  |

Les écritures de l'OS vers ce CRM restent soumises, côté OS, au double verrou habituel (`REAL_WRITES` et interrupteur de l'instance). Le connecteur lui-même vit dans le dépôt de l'OS, sous le nom générique `crm-os` (en lecture seule pour l'instant) : `connexion:set --kind crm --fournisseur crm-os`, puis `CRM_OS_URL` et `CRM_OS_TOKEN` (le `API_TOKEN` d'ici) dans le fichier de secrets de l'instance. Depuis le conteneur de l'OS, ce CRM local se joint par `http://host.docker.internal:4400`.

## Feuille de route

1. Socle : schéma des objets, migrations, API de santé (fait).
2. API CRM : entreprises, contacts, affaires, tâches, rendez-vous (fait). Reste : liens affaire ↔ contacts/entreprises, emails multiples, fusion.
3. Interface : accueil, pipe, fiche affaire, comptes, tâches, rendez-vous, étapes modifiables (fait). Reste : devis (avec Odoo).
4. Connecteur Odoo : comptes et contacts en lecture (fait). Reste : affaires, tâches, écriture sous double verrou, devis.
5. Échange avec l'OS : API d'échange pour le connecteur de l'OS (fait). Reste : le connecteur côté OS, puis éventuellement un pair sur le relais d'agents (`os-agents-relay`, profil `crm/1`).
6. Serveur MCP.
