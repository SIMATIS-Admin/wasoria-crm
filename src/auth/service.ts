import { createHash, randomBytes } from 'node:crypto';
import { and, count, eq, gt, lt, ne } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { sessions, utilisateurs } from '../db/schema.js';
import { ROLES, type Role } from './droits.js';
import { EMPREINTE_BIDON, hacher, problemeMotDePasse, verifier } from './mot-de-passe.js';

export const DUREE_SESSION_MS = 7 * 86_400_000;
// Une session utilisée est prolongée, mais pas à chaque requête.
const RAFRAICHIR_APRES_MS = 3_600_000;
const ECHECS_MAX = 5;
const BLOCAGE_MS = 15 * 60_000;

export type Utilisateur = { id: string; identifiant: string; nom: string; role: Role };

export class ErreurAuth extends Error {
  constructor(
    readonly code:
      | 'identifiants'
      | 'bloque'
      | 'invalide'
      | 'deja-installe'
      | 'existe'
      | 'conflit'
      | 'introuvable',
    message: string,
  ) {
    super(message);
  }
}

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest('hex');
export const normaliser = (identifiant: string) => identifiant.trim().toLowerCase();
const IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{1,63}$/;

export function creerAuth(db: Db, maintenant: () => Date = () => new Date()) {
  // Échecs de connexion par (appelant, identifiant), en mémoire : un redémarrage les remet à zéro.
  const echecs = new Map<string, { n: number; jusqua: number }>();
  const cle = (appelant: string, identifiant: string) => `${appelant}|${identifiant}`;

  async function creerUtilisateur(entree: {
    identifiant: string;
    nom: string;
    motDePasse: string;
    role?: Role;
  }) {
    if (entree.role !== undefined && !ROLES.includes(entree.role)) {
      throw new ErreurAuth('invalide', `Rôle inconnu : ${entree.role}`);
    }
    const identifiant = normaliser(entree.identifiant);
    if (!IDENTIFIANT.test(identifiant)) {
      throw new ErreurAuth(
        'invalide',
        'Identifiant : 2 à 64 caractères (lettres, chiffres, . _ -)',
      );
    }
    const nom = entree.nom.trim();
    if (!nom) throw new ErreurAuth('invalide', 'Le nom est obligatoire');
    const probleme = problemeMotDePasse(entree.motDePasse);
    if (probleme) throw new ErreurAuth('invalide', probleme);
    const [deja] = await db
      .select({ id: utilisateurs.id })
      .from(utilisateurs)
      .where(eq(utilisateurs.identifiant, identifiant));
    if (deja) throw new ErreurAuth('existe', 'Cet identifiant existe déjà');
    const [u] = await db
      .insert(utilisateurs)
      .values({
        identifiant,
        nom,
        motDePasse: await hacher(entree.motDePasse),
        role: entree.role ?? 'commercial',
      })
      .returning({
        id: utilisateurs.id,
        identifiant: utilisateurs.identifiant,
        nom: utilisateurs.nom,
        role: utilisateurs.role,
      });
    return u!;
  }

  async function nouvelleSession(utilisateurId: string) {
    const jeton = randomBytes(32).toString('base64url');
    const maintenantD = maintenant();
    await db.insert(sessions).values({
      id: empreinte(jeton),
      utilisateurId,
      expireLe: new Date(maintenantD.getTime() + DUREE_SESSION_MS),
    });
    // Ménage : les sessions échues ne servent plus.
    await db.delete(sessions).where(lt(sessions.expireLe, maintenantD));
    return jeton;
  }

  // Nom, rôle ou activation d'un compte. Il reste toujours au moins un administrateur actif, et on
  // ne se désactive pas soi-même (`acteurId`) : sinon plus personne ne pourrait gérer les comptes.
  async function modifierCompte(
    id: string,
    patch: { nom?: string; role?: Role; actif?: boolean },
    acteurId?: string,
  ) {
    if (patch.role !== undefined && !ROLES.includes(patch.role)) {
      throw new ErreurAuth('invalide', `Rôle inconnu : ${patch.role}`);
    }
    if (patch.nom !== undefined && !patch.nom.trim()) {
      throw new ErreurAuth('invalide', 'Le nom est obligatoire');
    }
    const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, id));
    if (!u) throw new ErreurAuth('introuvable', 'Compte introuvable');
    if (patch.actif === false && acteurId === id) {
      throw new ErreurAuth('conflit', 'Vous ne pouvez pas désactiver votre propre compte');
    }
    const perdAdmin =
      u.role === 'admin' &&
      u.actif &&
      (patch.role === 'commercial' || patch.role === 'lecture' || patch.actif === false);
    if (perdAdmin) {
      const [{ n } = { n: 0 }] = await db
        .select({ n: count() })
        .from(utilisateurs)
        .where(
          and(
            eq(utilisateurs.role, 'admin'),
            eq(utilisateurs.actif, true),
            ne(utilisateurs.id, id),
          ),
        );
      if (n === 0) {
        throw new ErreurAuth('conflit', 'Il doit rester au moins un administrateur actif');
      }
    }
    const valeurs = {
      ...(patch.nom !== undefined ? { nom: patch.nom.trim() } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.actif !== undefined ? { actif: patch.actif } : {}),
    };
    if (Object.keys(valeurs).length === 0)
      throw new ErreurAuth('invalide', 'Aucun champ à modifier');
    const [maj] = await db
      .update(utilisateurs)
      .set(valeurs)
      .where(eq(utilisateurs.id, id))
      .returning({
        id: utilisateurs.id,
        identifiant: utilisateurs.identifiant,
        nom: utilisateurs.nom,
        role: utilisateurs.role,
        actif: utilisateurs.actif,
      });
    // Désactiver ou changer de rôle : les sessions ouvertes sont rouvertes avec les bons droits.
    if (patch.actif === false || patch.role !== undefined) {
      await db.delete(sessions).where(eq(sessions.utilisateurId, id));
    }
    return maj!;
  }

  return {
    creerUtilisateur,

    async installe(): Promise<boolean> {
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(utilisateurs);
      return n > 0;
    },

    // Premier compte : seulement tant qu'aucun n'existe.
    async installer(entree: { identifiant: string; nom: string; motDePasse: string }) {
      const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(utilisateurs);
      if (n > 0) throw new ErreurAuth('deja-installe', 'Le CRM a déjà un compte');
      // La personne qui installe le CRM en est l'administratrice.
      return creerUtilisateur({ ...entree, role: 'admin' });
    },

    async connecter(appelant: string, identifiantSaisi: string, motDePasse: string) {
      const identifiant = normaliser(identifiantSaisi);
      const k = cle(appelant, identifiant);
      const bloc = echecs.get(k);
      const t = maintenant().getTime();
      if (bloc && bloc.n >= ECHECS_MAX && bloc.jusqua > t) {
        throw new ErreurAuth('bloque', 'Trop d’essais : réessayez dans quelques minutes');
      }
      const [u] = await db
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.identifiant, identifiant));
      // Toujours une vérification, même pour un identifiant inconnu ou désactivé.
      const ok = await verifier(motDePasse, u?.motDePasse ?? EMPREINTE_BIDON);
      if (!u || !u.actif || !ok) {
        const n = (bloc && bloc.jusqua > t ? bloc.n : 0) + 1;
        echecs.set(k, { n, jusqua: t + BLOCAGE_MS });
        throw new ErreurAuth('identifiants', 'Identifiant ou mot de passe incorrect');
      }
      echecs.delete(k);
      await db
        .update(utilisateurs)
        .set({ derniereConnexion: maintenant() })
        .where(eq(utilisateurs.id, u.id));
      return {
        jeton: await nouvelleSession(u.id),
        utilisateur: { id: u.id, identifiant: u.identifiant, nom: u.nom, role: u.role },
      };
    },

    async lireSession(jeton: string): Promise<Utilisateur | null> {
      const id = empreinte(jeton);
      const t = maintenant();
      const [l] = await db
        .select({ s: sessions, u: utilisateurs })
        .from(sessions)
        .innerJoin(utilisateurs, eq(sessions.utilisateurId, utilisateurs.id))
        .where(and(eq(sessions.id, id), gt(sessions.expireLe, t)));
      if (!l || !l.u.actif) return null;
      if (t.getTime() - l.s.vuLe.getTime() > RAFRAICHIR_APRES_MS) {
        await db
          .update(sessions)
          .set({ vuLe: t, expireLe: new Date(t.getTime() + DUREE_SESSION_MS) })
          .where(eq(sessions.id, id));
      }
      return { id: l.u.id, identifiant: l.u.identifiant, nom: l.u.nom, role: l.u.role };
    },

    async deconnecter(jeton: string) {
      await db.delete(sessions).where(eq(sessions.id, empreinte(jeton)));
    },

    async changerMotDePasse(identifiantSaisi: string, motDePasse: string) {
      const probleme = problemeMotDePasse(motDePasse);
      if (probleme) throw new ErreurAuth('invalide', probleme);
      const [u] = await db
        .update(utilisateurs)
        .set({ motDePasse: await hacher(motDePasse) })
        .where(eq(utilisateurs.identifiant, normaliser(identifiantSaisi)))
        .returning({ id: utilisateurs.id });
      if (!u) throw new ErreurAuth('invalide', 'Compte introuvable');
      // Changer le mot de passe coupe les sessions ouvertes.
      await db.delete(sessions).where(eq(sessions.utilisateurId, u.id));
    },

    async activer(identifiantSaisi: string, actif: boolean) {
      const [u] = await db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(eq(utilisateurs.identifiant, normaliser(identifiantSaisi)));
      if (!u) throw new ErreurAuth('introuvable', 'Compte introuvable');
      await modifierCompte(u.id, { actif });
    },

    modifierCompte,

    // Réinitialisation par un administrateur : coupe les sessions du compte.
    async reinitialiserMotDePasse(id: string, motDePasse: string) {
      const probleme = problemeMotDePasse(motDePasse);
      if (probleme) throw new ErreurAuth('invalide', probleme);
      const [u] = await db
        .update(utilisateurs)
        .set({ motDePasse: await hacher(motDePasse) })
        .where(eq(utilisateurs.id, id))
        .returning({ id: utilisateurs.id });
      if (!u) throw new ErreurAuth('introuvable', 'Compte introuvable');
      await db.delete(sessions).where(eq(sessions.utilisateurId, id));
    },

    // Changement par la personne elle-même : il faut son mot de passe actuel ; ses autres sessions se
    // ferment, celle en cours reste ouverte.
    async changerSonMotDePasse(
      id: string,
      actuel: string,
      nouveau: string,
      jetonSession: string | null,
    ) {
      const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, id));
      if (!u || !(await verifier(actuel, u.motDePasse))) {
        throw new ErreurAuth('identifiants', 'Le mot de passe actuel est incorrect');
      }
      const probleme = problemeMotDePasse(nouveau);
      if (probleme) throw new ErreurAuth('invalide', probleme);
      await db
        .update(utilisateurs)
        .set({ motDePasse: await hacher(nouveau) })
        .where(eq(utilisateurs.id, id));
      await db
        .delete(sessions)
        .where(
          jetonSession
            ? and(eq(sessions.utilisateurId, id), ne(sessions.id, empreinte(jetonSession)))
            : eq(sessions.utilisateurId, id),
        );
    },

    lister: () =>
      db
        .select({
          id: utilisateurs.id,
          identifiant: utilisateurs.identifiant,
          nom: utilisateurs.nom,
          role: utilisateurs.role,
          actif: utilisateurs.actif,
          derniereConnexion: utilisateurs.derniereConnexion,
        })
        .from(utilisateurs)
        .orderBy(utilisateurs.identifiant),
  };
}

export type Auth = ReturnType<typeof creerAuth>;
