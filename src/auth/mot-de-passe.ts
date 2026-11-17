import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Empreinte d'un mot de passe : scrypt avec un sel propre à chaque compte. Format stocké :
// scrypt$N$r$p$sel$empreinte (paramètres inclus, pour pouvoir les durcir plus tard).
const N = 16384;
const R = 8;
const P = 1;
const LONGUEUR = 64;
export const LONGUEUR_MINIMALE = 12;

const deriver = (mdp: string, sel: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(mdp.normalize('NFKC'), sel, LONGUEUR, { N: n, r, p }, (e, cle) =>
      e ? reject(e) : resolve(cle),
    );
  });

export async function hacher(mdp: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await deriver(mdp, sel, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sel.toString('base64')}$${cle.toString('base64')}`;
}

export async function verifier(mdp: string, empreinte: string): Promise<boolean> {
  const [algo, n, r, p, sel, cle] = empreinte.split('$');
  if (algo !== 'scrypt' || !n || !r || !p || !sel || !cle) return false;
  const attendu = Buffer.from(cle, 'base64');
  const obtenu = await deriver(mdp, Buffer.from(sel, 'base64'), Number(n), Number(r), Number(p));
  return attendu.length === obtenu.length && timingSafeEqual(attendu, obtenu);
}

// Pour qu'un identifiant inconnu coûte autant de temps qu'un mauvais mot de passe.
export const EMPREINTE_BIDON = await hacher(randomBytes(16).toString('hex'));

export function problemeMotDePasse(mdp: string): string | null {
  if (mdp.length < LONGUEUR_MINIMALE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères`;
  }
  return null;
}
