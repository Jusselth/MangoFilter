import { groupOffers } from '../domain/matching';
import { cleanText } from '../domain/normalize';
import type { CityId, Offer, SearchResult, StoreStatus } from '../domain/types';
import { ADAPTERS } from './adapters/stores';
import type { StoreAdapter } from './adapters/types';
import { TtlCache } from './cache';

/** Tiempo máximo que se espera a cada tienda antes de seguir sin ella. */
export const STORE_TIMEOUT_MS = 3_000;

export interface AggregatorOptions {
  adapters?: StoreAdapter<any>[];
  timeoutMs?: number;
  cache?: TtlCache<unknown[]>;
}

const sharedCache = new TtlCache<unknown[]>();

class TimeoutError extends Error {}

/** Ejecuta la consulta a una tienda con timeout y cancelación. */
async function queryStore(
  adapter: StoreAdapter<any>,
  query: string,
  city: CityId,
  timeoutMs: number,
  cache: TtlCache<unknown[]>,
): Promise<{ offers: Offer[]; status: StoreStatus }> {
  const started = Date.now();
  const key = `${adapter.storeId}|${query}`;
  const cached = cache.get(key);
  if (cached) {
    const offers = cached.map((raw) => adapter.normalize(raw, city));
    return {
      offers,
      status: { storeId: adapter.storeId, status: 'ok', count: offers.length, latencyMs: 0, fromCache: true },
    };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      adapter.fetchRaw(query, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          // Primero se rechaza con TimeoutError (gana la carrera) y luego se
          // cancela la petición en curso para liberar recursos.
          reject(new TimeoutError());
          controller.abort();
        }, timeoutMs);
      }),
    ]);
    cache.set(key, raw, adapter.cacheTtlMs);
    const offers: Offer[] = [];
    for (const item of raw) {
      try {
        offers.push(adapter.normalize(item, city));
      } catch {
        // Un registro malformado no debe tumbar toda la respuesta de la tienda.
      }
    }
    return {
      offers,
      status: { storeId: adapter.storeId, status: 'ok', count: offers.length, latencyMs: Date.now() - started, fromCache: false },
    };
  } catch (error) {
    return {
      offers: [],
      status: {
        storeId: adapter.storeId,
        status: error instanceof TimeoutError ? 'timeout' : 'error',
        count: 0,
        latencyMs: Date.now() - started,
        fromCache: false,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta federada: pregunta a todas las tiendas EN PARALELO, tolera fallos
 * parciales (una tienda caída no bloquea los resultados), normaliza y agrupa
 * las ofertas equivalentes con el motor de Entity Resolution.
 */
export async function searchProducts(rawQuery: string, city: CityId, options: AggregatorOptions = {}): Promise<SearchResult> {
  const started = Date.now();
  const query = cleanText(rawQuery);
  const adapters = options.adapters ?? ADAPTERS;
  const timeoutMs = options.timeoutMs ?? STORE_TIMEOUT_MS;
  const cache = options.cache ?? sharedCache;

  if (!query) {
    return { query: rawQuery, city, groups: [], stores: [], tookMs: 0 };
  }

  const responses = await Promise.all(adapters.map((a) => queryStore(a, query, city, timeoutMs, cache)));
  const offers = responses.flatMap((r) => r.offers);

  return {
    query: rawQuery,
    city,
    groups: groupOffers(offers),
    stores: responses.map((r) => r.status),
    tookMs: Date.now() - started,
  };
}

export function clearSearchCache(): void {
  sharedCache.clear();
}
