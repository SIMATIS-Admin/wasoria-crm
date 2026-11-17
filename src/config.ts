import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL est obligatoire' })
    .min(1, 'DATABASE_URL est obligatoire'),
  PORT: z.coerce.number().int().positive().default(4400),
  // Écritures réelles vers les outils tiers (Odoo, OS) : off par défaut.
  REAL_WRITES: z.enum(['on', 'off']).default('off'),
});

export type Config = { databaseUrl: string; port: number; realWrites: boolean };

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Configuration invalide : ${parsed.error.issues.map((i) => i.message).join(' ; ')}`,
    );
  }
  const { DATABASE_URL, PORT, REAL_WRITES } = parsed.data;
  return { databaseUrl: DATABASE_URL, port: PORT, realWrites: REAL_WRITES === 'on' };
}
