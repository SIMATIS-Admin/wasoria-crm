import { createInterface } from 'node:readline';
import pg from 'pg';
import { createDb } from '../db/index.js';
import { ROLES, type Role } from './droits.js';
import { creerAuth, ErreurAuth } from './service.js';

// npm run utilisateur -- creer <identifiant> [--nom "Nom"] [--role admin|commercial|lecture]
//                        | role <identifiant> <role> | mot-de-passe <identifiant>
//                        | desactiver <identifiant> | activer <identifiant> | lister
// Le mot de passe est saisi au clavier (rien ne s'affiche), jamais passé en argument.
function demander(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY,
    });
    if (process.stdin.isTTY) {
      const ecrire = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(
        rl,
      );
      let affiche = false;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => {
        if (!affiche) {
          affiche = true;
          ecrire(s);
        }
      };
    }
    rl.question(question, (reponse) => {
      rl.close();
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(reponse);
    });
  });
}

const [commande, identifiant, ...options] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL est obligatoire');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
const auth = creerAuth(createDb(pool));

async function motDePasseConfirme(): Promise<string> {
  const a = await demander('Mot de passe (12 caractères minimum) : ');
  const b = await demander('Confirmer le mot de passe : ');
  if (a !== b) throw new ErreurAuth('invalide', 'Les deux saisies diffèrent');
  return a;
}

try {
  if (commande === 'lister') {
    for (const u of await auth.lister()) {
      console.log(
        `${u.identifiant}\t${u.nom}\t${u.role}\t${u.actif ? 'actif' : 'désactivé'}\t${u.derniereConnexion?.toISOString() ?? 'jamais connecté'}`,
      );
    }
  } else if (commande === 'creer' && identifiant) {
    const i = options.indexOf('--nom');
    const nom = i >= 0 ? (options[i + 1] ?? identifiant) : identifiant;
    const r = options.indexOf('--role');
    const role = r >= 0 ? (options[r + 1] as Role) : 'commercial';
    if (!ROLES.includes(role))
      throw new ErreurAuth('invalide', `Rôle inconnu : ${role} (${ROLES.join(', ')})`);
    await auth.creerUtilisateur({ identifiant, nom, role, motDePasse: await motDePasseConfirme() });
    console.log(`Compte « ${identifiant} » créé (${role}).`);
  } else if (commande === 'role' && identifiant) {
    const role = options[0] as Role;
    if (!ROLES.includes(role))
      throw new ErreurAuth('invalide', `Rôle inconnu : ${role} (${ROLES.join(', ')})`);
    const [compte] = (await auth.lister()).filter(
      (u) => u.identifiant === identifiant.toLowerCase(),
    );
    if (!compte) throw new ErreurAuth('introuvable', 'Compte introuvable');
    await auth.modifierCompte(compte.id, { role });
    console.log(`Compte « ${identifiant} » : ${role} ; ses sessions sont fermées.`);
  } else if (commande === 'mot-de-passe' && identifiant) {
    await auth.changerMotDePasse(identifiant, await motDePasseConfirme());
    console.log('Mot de passe changé ; les sessions ouvertes sont fermées.');
  } else if ((commande === 'desactiver' || commande === 'activer') && identifiant) {
    await auth.activer(identifiant, commande === 'activer');
    console.log(`Compte « ${identifiant} » ${commande === 'activer' ? 'activé' : 'désactivé'}.`);
  } else {
    console.error(
      'Usage : npm run utilisateur -- creer <id> [--nom "Nom"] [--role admin|commercial|lecture] | role <id> <role> | mot-de-passe <id> | desactiver <id> | activer <id> | lister',
    );
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
