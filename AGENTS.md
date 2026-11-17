# WASORIA CRM — consignes pour les agents

CRM de WASORIA. Dépôt **public** : il ne contient que du code.

## Modèle et architecture

- **Le modèle de données est celui du CRM de SIMATIS OS** (`SIMATIS-Admin/SIMATIS-OS`, public) : mêmes tables et mêmes colonnes (`entreprises`, `contacts`, `opportunites` = « affaires » dans l'interface, `taches`, `rendez_vous`, `activites` et leurs liens). Ne pas s'en écarter sans raison : c'est ce qui permet la communication avec l'instance WASORIA de l'OS. Différence voulue : un seul client, donc pas d'`instance_id` ni de RLS.
- **Stack identique à l'OS** : Node 24, TypeScript, Fastify, Drizzle + Postgres, Zod, Vitest (+ Testcontainers), React + Vite pour l'interface.
- Chaque fiche porte `source` (`natif`, `odoo`, `os`…) et `source_id`. Une synchro met à jour la fiche trouvée par ce couple, ne duplique pas, et n'efface jamais une fiche disparue de la source.
- `updated_at` est tenu par des triggers Postgres (y compris pour les liens) : les synchros s'appuient dessus.

## Intégrations prévues

- **SIMATIS OS (instance WASORIA)** : échange des fiches selon le profil `crm/1` du kit `os-agents-relay`, comme les OS partenaires entre eux.
- **Odoo** : synchronisation dans les deux sens, sur le modèle des connecteurs de l'OS (`docs/AJOUTER-UN-CRM.md` de l'OS) : interface `sync` / `write` / `verify`, lecture seule par défaut, copie sans jamais effacer, ne toucher qu'à ses propres fiches (`source`), champs exclus respectés.
- **Serveurs MCP** : le CRM expose un serveur MCP pour les agents IA, comme l'OS (`src/mcp`) : un jeton par agent, passage par le cœur métier (jamais directement par la base), un agent propose et le pilote valide. Il pourra aussi consommer des serveurs MCP externes.
- **Écritures vers un système tiers** : simulation par défaut ; le mode réel exige un double verrou (`REAL_WRITES=on` côté serveur + interrupteur admin). Ne jamais lancer une écriture réelle sans demande explicite.

## Vérifier son travail

    npm run verify      # format, lint, types, tests, build

Docker doit être lancé (les tests démarrent un Postgres jetable). Chaque fonctionnalité arrive avec ses tests. Committer seulement un changement vérifié ; la CI rejoue ces commandes.

## Git

Une branche par feature (`feature/nom-court`) partant de `main` à jour, jamais de commit direct sur `main`. Feature terminée : PR, revue, CI verte, merge. Jamais de `--no-verify`, de `push --force` ni de `reset --hard` sans demande explicite. Ne jamais utiliser `git add -A` : ajouter les fichiers explicitement.

## Confidentialité (règle absolue)

Même règle que SIMATIS OS. Ne jamais écrire, committer ni pousser :

- noms de clients, prospects, contacts, collaborateurs, ni montants, prix ou tarifs réels de WASORIA ;
- données extraites d'Odoo, de l'OS, de Gmail ou de tout outil réel ;
- identifiants, mots de passe, clés d'API, jetons, URL d'instance, fichiers `.env` ;
- la maquette HTML d'origine et tout document client (exports, devis, rapports) ;
- contenu du second cerveau.

Les exemples, tests et démonstrations utilisent **uniquement des données manifestement fictives**. Secrets uniquement dans `.env` (toute nouvelle variable va aussi dans `.env.example`, sans valeur). Avant chaque commit : relire `git diff --staged`. En cas de doute, ne pas committer et demander.

## Langue

Documentation et interface en français. Code et identifiants cohérents avec ceux de l'OS.
