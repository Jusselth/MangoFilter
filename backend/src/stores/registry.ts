import type { StoreRef } from '../domain/types.js';
import { createMercadoLibreAdapter } from './mercadolibre.js';
import type { StoreAdapter } from './types.js';
import { createVtexAdapter, type VtexStoreConfig } from './vtex.js';

/**
 * Tiendas colombianas sobre VTEX cuya API pública de búsqueda y simulación de
 * envío se verificó en vivo (noviembre 2026). Para agregar otra tienda VTEX
 * basta con añadir una línea aquí.
 *
 * No se incluyen: Éxito (bloquea con Cloudflare), Alkosto/Ktronix/Homecenter/
 * Falabella (no tienen API pública; solo endpoints internos no documentados).
 */
export const VTEX_STORES: VtexStoreConfig[] = [
  { id: 'olimpica', name: 'Olímpica', short: 'OL', color: '#E30613', website: 'https://www.olimpica.com' },
  { id: 'jumbo', name: 'Jumbo', short: 'JU', color: '#00A651', website: 'https://www.jumbocolombia.com' },
  { id: 'carulla', name: 'Carulla', short: 'CA', color: '#00553A', website: 'https://www.carulla.com' },
  { id: 'pepeganga', name: 'Pepe Ganga', short: 'PG', color: '#F7D117', website: 'https://www.pepeganga.com' },
  { id: 'panamericana', name: 'Panamericana', short: 'PA', color: '#0057A8', website: 'https://www.panamericana.com.co' },
];

export function buildAdapters(env: { ML_CLIENT_ID?: string; ML_CLIENT_SECRET?: string; STORE_TIMEOUT_MS?: number }): StoreAdapter[] {
  const timeoutMs = env.STORE_TIMEOUT_MS ?? 6_000;
  const adapters = VTEX_STORES.map((s) => createVtexAdapter(s, { timeoutMs }));
  if (env.ML_CLIENT_ID && env.ML_CLIENT_SECRET) {
    adapters.push(createMercadoLibreAdapter(env.ML_CLIENT_ID, env.ML_CLIENT_SECRET, timeoutMs));
  }
  return adapters;
}

export function storeRefs(adapters: StoreAdapter[]): StoreRef[] {
  return adapters.map((a) => a.store);
}
