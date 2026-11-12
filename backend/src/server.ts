import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

import { createAggregator } from './aggregator.js';
import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { createPgDb } from './db/index.js';
import { createMailer, createServices, type Services } from './services.js';
import { buildAdapters, storeRefs } from './stores/registry.js';

// Variables de entorno desde backend/.env (ver .env.example).
if (existsSync('.env')) process.loadEnvFile('.env');

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0'; // 0.0.0.0 para que el celular (Expo Go) lo alcance por la red local.
const config = readConfig();

const adapters = buildAdapters({
  ML_CLIENT_ID: process.env.ML_CLIENT_ID,
  ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET,
  STORE_TIMEOUT_MS: process.env.STORE_TIMEOUT_MS ? Number(process.env.STORE_TIMEOUT_MS) : undefined,
});

/* ---------------- Cuentas, estadísticas y recomendaciones (opcional) ---------------- */
let services: Services | null = null;
const missing = [
  !config.databaseUrl && 'DATABASE_URL',
  !config.authSecret && 'AUTH_SECRET',
  !(config.gmailUser && config.gmailAppPassword) && !config.mailDevLog && 'GMAIL_USER + GMAIL_APP_PASSWORD',
].filter(Boolean);

if (missing.length === 0) {
  const db = createPgDb(config.databaseUrl!, config.databaseSslCaPath);
  try {
    await db.query(`select 1 from mangofilter.users limit 1`);
    services = createServices(db, createMailer(config)!, config);
  } catch (error) {
    console.error(
      `\n[db] No se pudo usar la base de datos: ${error instanceof Error ? error.message : String(error)}\n` +
        '     ¿Ejecutaste backend/db/schema.sql en el SQL Editor de Supabase? ¿La contraseña de DATABASE_URL es correcta?\n',
    );
    await db.close().catch(() => undefined);
  }
}

const app = buildApp({ aggregator: createAggregator(adapters), stores: storeRefs(adapters), services, logger: true, trustProxy: config.trustProxy });
await app.listen({ port: PORT, host: HOST });

if (services) {
  const s = services;
  const cleanup = () =>
    Promise.all([s.auth.cleanup(), s.analytics.cleanup()]).catch((e: unknown) => app.log.warn({ err: e }, 'limpieza periódica falló'));
  void cleanup();
  setInterval(cleanup, 60 * 60_000).unref();
  const close = async () => {
    await app.close();
    await s.db.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i!.address);
console.log(`\nMangoFilter API lista`);
console.log(`  Local:      http://localhost:${PORT}/api/health`);
for (const ip of lanIps) console.log(`  Red local:  http://${ip}:${PORT}/api/health`);
console.log(`  (Desde el celular usa la IP de tu red Wi-Fi; la app la detecta sola con Expo Go.)`);
console.log(`  Tiendas:    ${adapters.map((a) => a.store.name).join(', ')}`);
console.log(
  services
    ? `  Cuentas:    activas (base de datos + ${config.gmailUser ? `correo ${config.gmailUser}` : 'códigos en consola: MAIL_DEV_LOG'})\n`
    : `  Cuentas:    DESACTIVADAS${missing.length ? ` (falta en backend/.env: ${missing.join(', ')})` : ' (error de base de datos, ver arriba)'}\n`,
);
