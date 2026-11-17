import { configure } from '@testing-library/dom';

// Les tests de l'interface tournent en même temps que ceux qui démarrent des bases : sur une machine
// chargée, une attente de 1 s (la valeur par défaut) suffit parfois à les faire échouer sans raison.
configure({ asyncUtilTimeout: 5000 });
