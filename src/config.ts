import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL est obligatoire' })
    .min(1, 'DATABASE_URL est obligatoire'),
  // Jeton exigé de tout appelant de l'API (sauf /health). openssl rand -hex 24
  API_TOKEN: z
    .string({ error: 'API_TOKEN est obligatoire' })
    .min(24, 'API_TOKEN : 24 caractères minimum'),
  // « on » derrière un proxy https (adresse du client, cookie Secure).
  TRUST_PROXY: z.enum(['on', 'off']).default('off'),
  PORT: z.coerce.number().int().positive().default(4400),
  // Écritures réelles vers les outils tiers (Odoo, OS) : off par défaut.
  REAL_WRITES: z.enum(['on', 'off']).default('off'),
  // Mode démonstration : un bouton recharge un scénario fictif en EFFAÇANT les données. Jamais « on »
  // sur un CRM qui contient de vraies données.
  DEMO_MODE: z.enum(['on', 'off']).default('off'),
});

export type Config = {
  databaseUrl: string;
  apiToken: string;
  trustProxy: boolean;
  port: number;
  realWrites: boolean;
  demo: boolean;
};

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Configuration invalide : ${parsed.error.issues.map((i) => i.message).join(' ; ')}`,
    );
  }
  const { DATABASE_URL, API_TOKEN, PORT, REAL_WRITES, TRUST_PROXY, DEMO_MODE } = parsed.data;
  return {
    databaseUrl: DATABASE_URL,
    apiToken: API_TOKEN,
    trustProxy: TRUST_PROXY === 'on',
    port: PORT,
    realWrites: REAL_WRITES === 'on',
    demo: DEMO_MODE === 'on',
  };
}
