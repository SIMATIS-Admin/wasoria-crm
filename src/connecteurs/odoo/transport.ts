import type { OdooConfig } from './config.js';

export type Domaine = (string | number | boolean | Domaine)[][];
export type Fiche = Record<string, unknown>;

// Ce dont la synchro a besoin d'Odoo : lire. Aucune écriture dans cette version.
export interface Transport {
  searchRead(
    modele: string,
    options: {
      domaine: Domaine;
      champs: string[];
      limite: number;
      decalage: number;
      ordre: string;
    },
  ): Promise<Fiche[]>;
  // Teste les accès : renvoie un libellé de la connexion (jamais un secret).
  verifier(): Promise<string>;
}

export class ErreurOdoo extends Error {}

type Fetch = typeof fetch;

async function post(f: Fetch, url: string, corps: unknown, entetes: Record<string, string>) {
  const reponse = await f(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(30_000),
  });
  const texte = await reponse.text();
  let json: unknown;
  try {
    json = JSON.parse(texte);
  } catch {
    throw new ErreurOdoo(`Réponse d'Odoo illisible (HTTP ${reponse.status})`);
  }
  return { statut: reponse.status, json };
}

// Odoo 19 et suivants : API JSON-2, clé d'API en jeton Bearer.
export function transportJson2(config: OdooConfig, f: Fetch = fetch): Transport {
  const appeler = async (chemin: string, corps: object) => {
    const { statut, json } = await post(f, `${config.url}/json/2/${chemin}`, corps, {
      authorization: `bearer ${config.cle}`,
      ...(config.base ? { 'x-odoo-database': config.base } : {}),
    });
    if (statut !== 200) {
      const message = (json as { message?: string }).message ?? `HTTP ${statut}`;
      throw new ErreurOdoo(`Odoo a refusé la requête : ${message}`);
    }
    return json;
  };
  return {
    async searchRead(modele, o) {
      const r = await appeler(`${modele}/search_read`, {
        domain: o.domaine,
        fields: o.champs,
        limit: o.limite,
        offset: o.decalage,
        order: o.ordre,
      });
      return r as Fiche[];
    },
    async verifier() {
      const r = (await appeler('res.users/search_read', {
        domain: [],
        fields: ['name'],
        limit: 1,
      })) as { name?: string }[];
      return `Odoo (JSON-2), connecté en tant que ${r[0]?.name ?? 'utilisateur inconnu'}`;
    },
  };
}

// Odoo 17 et 18 : API externe JSON-RPC (base, identifiant, clé d'API).
export function transportJsonRpc(config: OdooConfig, f: Fetch = fetch): Transport {
  let uid: number | null = null;
  const rpc = async (service: string, methode: string, args: unknown[]) => {
    const { json } = await post(
      f,
      `${config.url}/jsonrpc`,
      { jsonrpc: '2.0', method: 'call', params: { service, method: methode, args }, id: 1 },
      {},
    );
    const r = json as {
      result?: unknown;
      error?: { data?: { message?: string }; message?: string };
    };
    if (r.error)
      throw new ErreurOdoo(
        `Odoo a refusé la requête : ${r.error.data?.message ?? r.error.message ?? 'erreur'}`,
      );
    return r.result;
  };
  const connecter = async () => {
    if (uid === null) {
      const r = await rpc('common', 'authenticate', [
        config.base,
        config.identifiant,
        config.cle,
        {},
      ]);
      if (typeof r !== 'number') throw new ErreurOdoo('Odoo a refusé les identifiants');
      uid = r;
    }
    return uid;
  };
  const executer = async (modele: string, methode: string, args: unknown[], kwargs: object) =>
    rpc('object', 'execute_kw', [
      config.base,
      await connecter(),
      config.cle,
      modele,
      methode,
      args,
      kwargs,
    ]);
  return {
    async searchRead(modele, o) {
      const r = await executer(modele, 'search_read', [o.domaine], {
        fields: o.champs,
        limit: o.limite,
        offset: o.decalage,
        order: o.ordre,
      });
      return r as Fiche[];
    },
    async verifier() {
      const r = (await executer('res.users', 'search_read', [[]], {
        fields: ['name'],
        limit: 1,
      })) as {
        name?: string;
      }[];
      return `Odoo (JSON-RPC), connecté en tant que ${r[0]?.name ?? 'utilisateur inconnu'}`;
    },
  };
}

export const creerTransport = (config: OdooConfig, f?: Fetch): Transport =>
  config.protocole === 'json2' ? transportJson2(config, f) : transportJsonRpc(config, f);
