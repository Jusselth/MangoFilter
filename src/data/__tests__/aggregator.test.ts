import { searchProducts } from '../aggregator';
import { ADAPTERS } from '../adapters/stores';
import type { StoreAdapter } from '../adapters/types';
import { TtlCache } from '../cache';

/** Misma respuesta del adaptador real (con su latencia simulada, < 1,2 s). */
const instant = (adapter: StoreAdapter<any>): StoreAdapter<any> => adapter;

describe('agregador federado', () => {
  it('consulta todas las tiendas y agrupa el mismo producto', async () => {
    const result = await searchProducts('audífonos sony', 'bogota', {
      adapters: ADAPTERS.map(instant),
      cache: new TtlCache(),
    });
    const xm5 = result.groups.find((g) => g.offers.some((o) => /1000XM5/.test(o.title)));
    expect(xm5?.offers.map((o) => o.storeId).sort()).toEqual(['aliexpress', 'alkosto', 'falabella', 'mercadolibre']);
    expect(result.stores.every((s) => s.status === 'ok')).toBe(true);
  });

  it('tolera una tienda caída o lenta', async () => {
    const broken: StoreAdapter<any> = { ...ADAPTERS[0], fetchRaw: () => Promise.reject(new Error('500')) };
    const slow: StoreAdapter<any> = {
      ...ADAPTERS[1],
      fetchRaw: (_q, signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
    };
    const result = await searchProducts('parlante jbl', 'bogota', {
      adapters: [broken, slow, instant(ADAPTERS[4])],
      timeoutMs: 900, // Alkosto responde en ~540 ms; la tienda "lenta" nunca responde
      cache: new TtlCache(),
    });
    expect(result.stores.map((s) => s.status)).toEqual(['error', 'timeout', 'ok']);
    expect(result.groups.length).toBeGreaterThan(0);
  });

  it('reutiliza la caché y recalcula envío al cambiar de ciudad', async () => {
    const cache = new TtlCache<unknown[]>();
    const adapters = [instant(ADAPTERS[0])];
    const first = await searchProducts('parlante jbl', 'bogota', { adapters, cache });
    const second = await searchProducts('parlante jbl', 'leticia', { adapters, cache });
    expect(second.stores[0].fromCache).toBe(true);
    const days = (r: typeof first) => r.groups[0].offers[0].deliveryDays;
    expect(days(second)).toBeGreaterThan(days(first));
  });
});
