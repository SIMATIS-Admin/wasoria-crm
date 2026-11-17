import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL est obligatoire' })
    .min(1, 'DATABASE_URL est obligatoire'),
  // Jeton exigé de tout appelant de l'API (sauf /health). openssl rand -hex 24
  API_TOKEN: z
    .string({ error: 'API_TOKEN est obligatoire' })
    .min(24, 'API_TOKEN : 24 caractères minimum'),
  PORT: z.coerce.number().int().positive().default(4400),
  // Écritures réelles vers les outils tiers (Odoo, OS) : off par défaut.
  REAL_WRITES: z.enum(['on', 'off']).default('off'),
});

export type Config = { databaseUrl: string; apiToken: string; port: number; realWrites: boolean };

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Configuration invalide : ${parsed.error.issues.map((i) => i.message).join(' ; ')}`,
    );
  }
  const { DATABASE_URL, API_TOKEN, PORT, REAL_WRITES } = parsed.data;
  return {
    databaseUrl: DATABASE_URL,
    apiToken: API_TOKEN,
    port: PORT,
    realWrites: REAL_WRITES === 'on',
  };
}
