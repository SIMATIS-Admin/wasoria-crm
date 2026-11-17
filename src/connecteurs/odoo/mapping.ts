import type { Fiche } from './transport.js';

// Odoo renvoie `false` pour un champ vide, et [id, nom] pour un lien.
const texte = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const lien = (v: unknown): [number, string] | null =>
  Array.isArray(v) && typeof v[0] === 'number' ? [v[0], String(v[1] ?? '')] : null;

// « https://www.exemple.fr/accueil » → « exemple.fr »
export function domaineDe(site: unknown): string | null {
  const brut = texte(site);
  if (!brut) return null;
  try {
    return new URL(/^https?:\/\//i.test(brut) ? brut : `https://${brut}`).hostname.replace(
      /^www\./,
      '',
    );
  } catch {
    return null;
  }
}

// Champs Odoo lus par objet, et leur colonne du CRM (mêmes noms que le profil crm/1 de l'OS).
// Un champ exclu n'est ni demandé à Odoo ni écrit.
export const CHAMPS_ENTREPRISE = {
  city: 'ville',
  website: 'domaine',
  industry_id: 'secteur',
} as const;
export const CHAMPS_CONTACT = {
  function: 'fonction',
  email: 'email',
  phone: 'telephone',
  mobile: 'telephone',
} as const;

const retenu = (exclus: Set<string>, objet: string, colonne: string) =>
  !exclus.has(`${objet}.${colonne}`);

export function champsDemandes(objet: 'entreprise' | 'contact', exclus: Set<string>): string[] {
  const table = objet === 'entreprise' ? CHAMPS_ENTREPRISE : CHAMPS_CONTACT;
  const base = ['id', 'name', 'write_date', ...(objet === 'contact' ? ['parent_id'] : [])];
  return [
    ...base,
    ...Object.entries(table)
      .filter(([, colonne]) => retenu(exclus, objet, colonne))
      .map(([champ]) => champ),
  ];
}

export function versEntreprise(p: Fiche, exclus: Set<string>) {
  const nom = texte(p.name);
  if (!nom) return null;
  const v: Record<string, string | null> = { nom };
  if (retenu(exclus, 'entreprise', 'ville')) v.ville = texte(p.city);
  if (retenu(exclus, 'entreprise', 'domaine')) v.domaine = domaineDe(p.website);
  if (retenu(exclus, 'entreprise', 'secteur')) v.secteur = lien(p.industry_id)?.[1] ?? null;
  return v;
}

export function versContact(p: Fiche, exclus: Set<string>) {
  const nom = texte(p.name);
  if (!nom) return null;
  const v: Record<string, string | null> = { nom };
  if (retenu(exclus, 'contact', 'fonction')) v.fonction = texte(p.function);
  if (retenu(exclus, 'contact', 'email')) v.email = texte(p.email);
  if (retenu(exclus, 'contact', 'telephone')) v.telephone = texte(p.phone) ?? texte(p.mobile);
  return v;
}

export const parentDe = (p: Fiche): number | null => lien(p.parent_id)?.[0] ?? null;
export const dateModif = (p: Fiche): string | null => texte(p.write_date);
