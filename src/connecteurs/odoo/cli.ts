import pg from 'pg';
import { createDb } from '../../db/index.js';
import { chargerConfigOdoo } from './config.js';
import { creerServiceOdoo } from './service.js';

// npm run odoo -- verifier | synchroniser [--complet]
const [commande, ...options] = process.argv.slice(2);
const config = chargerConfigOdoo(process.env);
if (!config) {
  console.error('Odoo n’est pas configuré : renseigner ODOO_URL et ODOO_API_KEY dans .env');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL est obligatoire');
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
const service = creerServiceOdoo(createDb(pool), config);
try {
  if (commande === 'verifier') {
    console.log(await service.verifier());
  } else if (commande === 'synchroniser') {
    console.log(
      JSON.stringify(
        await service.synchroniser({ complet: options.includes('--complet') }),
        null,
        2,
      ),
    );
  } else {
    console.error('Usage : npm run odoo -- verifier | synchroniser [--complet]');
    process.exitCode = 1;
  }
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : erreur);
  process.exitCode = 1;
} finally {
  await pool.end();
}
