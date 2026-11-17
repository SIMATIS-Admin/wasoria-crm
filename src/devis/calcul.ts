// Totaux d'un devis. Fonctions pures : mêmes lignes, même formule, mêmes montants. Montants en
// euros HT.
export type LigneCalcul = { prixUnitaire: number; quantite: number; recurrent: boolean };

export type Formule = 'achat' | 'abonnement';

export type Totaux = {
  // Payé une fois (lignes non récurrentes).
  investissement: number;
  // Facturé chaque année (lignes récurrentes).
  servicesAnnuels: number;
  // Achat : investissement + une année de services.
  totalPremiereAnnee: number;
  // Abonnement seulement : mensualité (investissement financé + services lissés), coût du
  // financement et total payé sur la durée.
  mensualite: number | null;
  coutFinancement: number | null;
  totalSurDuree: number | null;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function totaux(
  lignes: LigneCalcul[],
  {
    formule,
    dureeMois,
    tauxCentiemes,
  }: { formule: Formule; dureeMois: number; tauxCentiemes: number },
): Totaux {
  const somme = (recurrent: boolean) =>
    lignes
      .filter((l) => l.recurrent === recurrent)
      .reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);
  const investissement = somme(false);
  const servicesAnnuels = somme(true);
  const base = {
    investissement,
    servicesAnnuels,
    totalPremiereAnnee: investissement + servicesAnnuels,
  };
  if (formule === 'achat' || dureeMois <= 0) {
    return { ...base, mensualite: null, coutFinancement: null, totalSurDuree: null };
  }
  // Mensualité d'un prêt à annuités constantes ; sans intérêt, l'investissement se divise.
  const r = tauxCentiemes / 10_000 / 12;
  const parMois =
    r === 0 ? investissement / dureeMois : (investissement * r) / (1 - (1 + r) ** -dureeMois);
  const mensualite = parMois + servicesAnnuels / 12;
  return {
    ...base,
    mensualite: arrondi(mensualite),
    coutFinancement: arrondi(parMois * dureeMois - investissement),
    totalSurDuree: arrondi(mensualite * dureeMois),
  };
}

// Un devis suit un cycle : brouillon (modifiable) → envoyé → accepté ou refusé. Un devis envoyé peut
// repasser en brouillon pour être corrigé ; une décision se rouvre en « envoyé ».
export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse';
const TRANSITIONS: Record<StatutDevis, StatutDevis[]> = {
  brouillon: ['envoye'],
  envoye: ['brouillon', 'accepte', 'refuse'],
  accepte: ['envoye'],
  refuse: ['envoye'],
};
export const transitionPossible = (de: StatutDevis, vers: StatutDevis) =>
  TRANSITIONS[de].includes(vers);

export const DUREES_MOIS = [36, 48, 60] as const;
