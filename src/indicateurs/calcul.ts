// Calcul des indicateurs du cycle de vente à partir des dates d'étapes des affaires. Fonctions
// pures : le même jeu d'affaires et la même période donnent toujours le même résultat.
export const GAGNE = '@gagne';
export const PERDU = '@perdu';
const JOUR_MS = 86_400_000;

export type AffaireCalcul = {
  creeLe: Date;
  etapesDates: Record<string, string>;
  clos: 'gagne' | 'perdu' | null;
  closLe: Date | null;
};

export type Definition = {
  id: string;
  label: string;
  type: 'delai' | 'conversion' | 'entrants';
  deEtape: string | null;
  versEtape: string | null;
  objectif: number | null;
};

export type Resultat = {
  valeur: number | null;
  // Délais : la moyenne à côté de la médiane. Conversions : nombre d'affaires qui ont atteint l'étape.
  moyenne?: number | null;
  convertis?: number;
  // Affaires prises en compte (celles qui ont fini le trajet, ou qui l'ont commencé pour une conversion).
  n: number;
  serie?: { semaine: string; n: number }[];
};

export type Statut = 'ok' | 'hors-objectif' | 'sans-objectif' | 'sans-donnee' | 'a-configurer';

const date = (v: string | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Date d'arrivée de l'affaire à une étape, ou de sa clôture (`@gagne`, `@perdu`).
function dateEtape(a: AffaireCalcul, etape: string): Date | null {
  if (etape === GAGNE) return a.clos === 'gagne' ? a.closLe : null;
  if (etape === PERDU) return a.clos === 'perdu' ? a.closLe : null;
  return date(a.etapesDates[etape]);
}

// Une affaire gagnée avant que ce CRM date les clôtures a un `clos` sans date : elle compte quand
// même comme gagnée dans une conversion.
function atteint(a: AffaireCalcul, etape: string): boolean {
  if (etape === GAGNE) return a.clos === 'gagne';
  if (etape === PERDU) return a.clos === 'perdu';
  return date(a.etapesDates[etape]) !== null;
}

const arrondi = (n: number, decimales = 1) => {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
};

export function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? (t[m] as number) : ((t[m - 1] as number) + (t[m] as number)) / 2;
}

// Lundi 00:00 UTC de la semaine de `d`.
export function debutDeSemaine(d: Date): Date {
  const j = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  j.setUTCDate(j.getUTCDate() - ((j.getUTCDay() + 6) % 7));
  return j;
}

export function calculer(
  def: Definition,
  affaires: AffaireCalcul[],
  { jours, maintenant }: { jours: number; maintenant: Date },
): Resultat {
  const debut = new Date(maintenant.getTime() - jours * JOUR_MS);
  const dans = (d: Date | null): d is Date => d !== null && d >= debut && d <= maintenant;

  if (def.type === 'entrants') {
    const semaines = Math.max(1, Math.ceil(jours / 7));
    const courante = debutDeSemaine(maintenant);
    const premiere = new Date(courante.getTime() - (semaines - 1) * 7 * JOUR_MS);
    const serie = Array.from({ length: semaines }, (_, i) => ({
      semaine: new Date(premiere.getTime() + i * 7 * JOUR_MS).toISOString().slice(0, 10),
      n: 0,
    }));
    let total = 0;
    for (const a of affaires) {
      if (a.creeLe < premiere || a.creeLe > maintenant) continue;
      const i = Math.floor(
        (debutDeSemaine(a.creeLe).getTime() - premiere.getTime()) / (7 * JOUR_MS),
      );
      if (serie[i]) {
        serie[i].n += 1;
        total += 1;
      }
    }
    return { valeur: arrondi(total / semaines), n: total, serie };
  }

  if (!def.deEtape || !def.versEtape) return { valeur: null, n: 0 };
  const { deEtape, versEtape } = def;

  if (def.type === 'delai') {
    const jours_ = affaires.flatMap((a) => {
      const d1 = dateEtape(a, deEtape);
      const d2 = dateEtape(a, versEtape);
      return d1 && dans(d2) && d2 >= d1 ? [(d2.getTime() - d1.getTime()) / JOUR_MS] : [];
    });
    const m = mediane(jours_);
    return {
      valeur: m === null ? null : arrondi(m),
      moyenne: jours_.length ? arrondi(jours_.reduce((s, x) => s + x, 0) / jours_.length) : null,
      n: jours_.length,
    };
  }

  const cohorte = affaires.filter((a) => dans(dateEtape(a, deEtape)));
  const convertis = cohorte.filter((a) => atteint(a, versEtape)).length;
  return {
    valeur: cohorte.length ? Math.round((convertis / cohorte.length) * 100) : null,
    convertis,
    n: cohorte.length,
  };
}

// Délais : plus c'est court, mieux c'est. Conversions et entrants : plus c'est haut, mieux c'est.
export function statut(def: Definition, r: Resultat): Statut {
  if (def.type !== 'entrants' && (!def.deEtape || !def.versEtape)) return 'a-configurer';
  if (r.valeur === null) return 'sans-donnee';
  if (def.objectif === null) return 'sans-objectif';
  const bon = def.type === 'delai' ? r.valeur <= def.objectif : r.valeur >= def.objectif;
  return bon ? 'ok' : 'hors-objectif';
}
