import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

import { createAggregator } from './aggregator.js';
import { buildApp } from './app.js';
import { buildAdapters, storeRefs } from './stores/registry.js';

// Variables de entorno opcionales desde backend/.env (ver .env.example).
if (existsSync('.env')) process.loadEnvFile('.env');

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0'; // 0.0.0.0 para que el celular (Expo Go) lo alcance por la red local.

const adapters = buildAdapters({
  ML_CLIENT_ID: process.env.ML_CLIENT_ID,
  ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET,
  STORE_TIMEOUT_MS: process.env.STORE_TIMEOUT_MS ? Number(process.env.STORE_TIMEOUT_MS) : undefined,
});
const app = buildApp({ aggregator: createAggregator(adapters), stores: storeRefs(adapters), logger: true });

await app.listen({ port: PORT, host: HOST });

const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i!.address);
console.log(`\nMangoFilter API lista`);
console.log(`  Local:      http://localhost:${PORT}/api/health`);
for (const ip of lanIps) console.log(`  Red local:  http://${ip}:${PORT}/api/health`);
console.log(`  (Desde el celular usa la IP de tu red Wi-Fi; la app la detecta sola con Expo Go.)`);
console.log(`  Tiendas:    ${adapters.map((a) => a.store.name).join(', ')}\n`);
