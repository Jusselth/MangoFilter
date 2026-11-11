import { TtlCache } from './cache.js';
import { groupOffers } from './domain/matching.js';
import type { City, Offer, ProductGroup, SearchResponse, StoreStatus } from './domain/types.js';
import { TimeoutError } from './http.js';
import type { StoreAdapter } from './stores/types.js';

/** Puestos que "sube" un producto por cada tienda adicional en la que se encontró. */
export const MULTI_STORE_BOOST = 3;

/**
 * Orden de la lista: relevancia según las tiendas (la mejor posición de sus
 * ofertas), con un empujón moderado a los productos comparados en varias
 * tiendas, que son el valor central de MangoFilter.
 */
export function sortByRelevance(groups: ProductGroup[]): ProductGroup[] {
  const key = (g: ProductGroup) => Math.min(...g.offers.map((o) => o.position)) - MULTI_STORE_BOOST * (g.offers.length - 1);
  return [...groups].sort((a, b) => key(a) - key(b) || b.offers.length - a.offers.length);
}

export interface AggregatorOptions {
  /** Tiempo máximo total por tienda (búsqueda + simulación). */
  storeTimeoutMs?: number;
  responseCache?: TtlCache<SearchResponse>;
}

/** Normaliza la consulta para usarla como clave de caché y en las tiendas. */
export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Consulta federada: pregunta a todas las tiendas EN PARALELO, tolera fallos
 * parciales (una tienda caída o lenta no bloquea las demás) y agrupa las
 * ofertas equivalentes con el motor de Entity Resolution.
 */
export function createAggregator(adapters: StoreAdapter[], options: AggregatorOptions = {}) {
  const storeTimeoutMs = options.storeTimeoutMs ?? 9_000;
  const responseCache = options.responseCache ?? new TtlCache<SearchResponse>(300);

  async function queryStore(adapter: StoreAdapter, query: string, city: City): Promise<{ offers: Offer[]; status: StoreStatus }> {
    const started = Date.now();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        adapter.search(query, city, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new TimeoutError(adapter.store.name));
            controller.abort();
          }, storeTimeoutMs);
        }),
      ]);
      return {
        offers: result.offers,
        status: {
          store: adapter.store,
          status: 'ok',
          count: result.offers.length,
          notShippable: result.notShippable,
          latencyMs: Date.now() - started,
          fromCache: result.fromCache,
        },
      };
    } catch (error) {
      const timeout = error instanceof TimeoutError;
      return {
        offers: [],
        status: {
          store: adapter.store,
          status: timeout ? 'timeout' : 'error',
          count: 0,
          notShippable: 0,
          latencyMs: Date.now() - started,
          fromCache: false,
          message: error instanceof Error ? error.message : 'Error desconocido',
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async search(rawQuery: string, city: City): Promise<SearchResponse> {
      const query = normalizeQuery(rawQuery);
      const key = `${city.id}|${query}`;
      const cached = responseCache.get(key);
      if (cached) {
        return { ...cached, stores: cached.stores.map((s) => ({ ...s, fromCache: true, latencyMs: 0 })), tookMs: 0 };
      }

      const started = Date.now();
      const responses = await Promise.all(adapters.map((a) => queryStore(a, query, city)));
      const result: SearchResponse = {
        query: rawQuery.trim(),
        city,
        groups: sortByRelevance(groupOffers(responses.flatMap((r) => r.offers))),
        stores: responses.map((r) => r.status),
        tookMs: Date.now() - started,
        fetchedAt: new Date().toISOString(),
      };
      // Solo se cachea si al menos una tienda respondió bien (no se guardan caídas totales).
      if (result.stores.some((s) => s.status === 'ok')) responseCache.set(key, result, 5 * 60_000);
      return result;
    },
    clearCache() {
      responseCache.clear();
    },
  };
}

export type Aggregator = ReturnType<typeof createAggregator>;
