import { z } from 'zod';

// Odoo n'est branché que si ODOO_URL est renseignée. Les secrets restent dans .env.
const schema = z.object({
  ODOO_URL: z.url(),
  ODOO_PROTOCOL: z.enum(['json2', 'jsonrpc']).default('json2'),
  // json2 (Odoo 19+) : la base est facultative. jsonrpc : base, identifiant et clé d'API requis.
  ODOO_DB: z.string().min(1).optional(),
  ODOO_LOGIN: z.string().min(1).optional(),
  ODOO_API_KEY: z.string().min(1),
  // Champs à ne jamais lire ni copier, au format « objet.champ » (ex. contact.telephone).
  ODOO_CHAMPS_EXCLUS: z.string().optional(),
});

export type OdooConfig = {
  url: string;
  protocole: 'json2' | 'jsonrpc';
  base?: string;
  identifiant?: string;
  cle: string;
  champsExclus: Set<string>;
};

const vide = (v: string | undefined) => (v === undefined || v.trim() === '' ? undefined : v.trim());

export function chargerConfigOdoo(env: Record<string, string | undefined>): OdooConfig | null {
  if (!vide(env.ODOO_URL)) return null;
  const parsed = schema.safeParse({
    ODOO_URL: vide(env.ODOO_URL),
    ODOO_PROTOCOL: vide(env.ODOO_PROTOCOL),
    ODOO_DB: vide(env.ODOO_DB),
    ODOO_LOGIN: vide(env.ODOO_LOGIN),
    ODOO_API_KEY: vide(env.ODOO_API_KEY),
    ODOO_CHAMPS_EXCLUS: vide(env.ODOO_CHAMPS_EXCLUS),
  });
  if (!parsed.success) {
    throw new Error(
      `Configuration Odoo invalide : ${parsed.error.issues.map((i) => `${i.path.join('.')} (${i.message})`).join(' ; ')}`,
    );
  }
  const c = parsed.data;
  const url = new URL(c.ODOO_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw new Error('Configuration Odoo invalide : ODOO_URL doit être en https');
  }
  if (c.ODOO_PROTOCOL === 'jsonrpc' && (!c.ODOO_DB || !c.ODOO_LOGIN)) {
    throw new Error('Configuration Odoo invalide : jsonrpc exige ODOO_DB et ODOO_LOGIN');
  }
  return {
    url: url.origin,
    protocole: c.ODOO_PROTOCOL,
    base: c.ODOO_DB,
    identifiant: c.ODOO_LOGIN,
    cle: c.ODOO_API_KEY,
    champsExclus: new Set(
      (c.ODOO_CHAMPS_EXCLUS ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  };
}
