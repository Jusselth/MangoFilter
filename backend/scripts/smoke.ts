/**
 * Prueba de humo EN VIVO contra las tiendas reales (no corre en `npm test`).
 * Uso: npm run smoke -- "freidora de aire" medellin
 */
import { createAggregator } from '../src/aggregator.js';
import { findCity } from '../src/cities.js';
import { buildAdapters } from '../src/stores/registry.js';

if (process.env.npm_config_local_prefix) process.chdir(process.env.npm_config_local_prefix);
try { process.loadEnvFile('.env'); } catch { /* .env es opcional */ }

const [query = 'freidora de aire', cityId = 'bogota'] = process.argv.slice(2);
const city = findCity(cityId);
if (!city) throw new Error(`Ciudad desconocida: ${cityId}`);

const aggregator = createAggregator(buildAdapters(process.env));
const r = await aggregator.search(query, city);

console.log(`\n"${r.query}" en ${city.name}: ${r.groups.length} productos en ${r.tookMs} ms`);
for (const s of r.stores) {
  console.log(`  ${s.status === 'ok' ? '✔' : '✖'} ${s.store.name.padEnd(13)} ${s.status.padEnd(7)} ofertas=${s.count} sin-despacho=${s.notShippable} ${s.latencyMs}ms ${s.message ?? ''}`);
}
for (const g of r.groups.filter((g) => g.offers.length > 1).slice(0, 5)) {
  console.log(`\n  ★ ${g.name}`);
  for (const o of g.offers) console.log(`     ${o.store.name.padEnd(13)} $${o.totalCost.toLocaleString('es-CO')} (envío ${o.shippingCost ?? '?'}, ${o.deliveryDays ?? '?'} días)  ${o.url}`);
}
if (!r.stores.some((s) => s.status === 'ok')) process.exit(1);
