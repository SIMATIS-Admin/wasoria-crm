# Règles du projet

Ce dépôt est PUBLIC. Il ne contient que du code.

- Aucune donnée : ni clients, contacts, prix, devis, factures, noms de collaborateurs, ni données d'exemple réalistes issues de WASORIA ou de SIMATIS.
- Aucun secret : clés, tokens, mots de passe, URL d'instance. Tout passe par des variables d'environnement (`.env` ignoré, seul `.env.example` avec des valeurs vides est versionné).
- Les données de test sont générées et manifestement fictives, jamais copiées d'une vraie source.
- Même règle de confidentialité que SIMATIS OS.
- Avant chaque commit : vérifier `git diff --cached` pour s'assurer qu'aucune donnée n'y figure.
