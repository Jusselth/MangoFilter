import { describe, expect, it } from 'vitest';

import { createAggregator, sortByRelevance } from '../src/aggregator.js';
import { buildApp } from '../src/app.js';
import { CITIES } from '../src/cities.js';
import { normalizeTitle } from '../src/domain/normalize.js';
import type { Offer, StoreRef } from '../src/domain/types.js';
import type { StoreAdapter } from '../src/stores/types.js';

const ref = (id: string): StoreRef => ({ id, name: id, short: id.slice(0, 2), color: '#000', website: `https://${id}.co` });

function okAdapter(id: string, title: string, price: number): StoreAdapter {
  const store = ref(id);
  return {
    store,
    async search() {
      const o: Offer = {
        id: `${id}:1`, store, title, normalizedTitle: normalizeTitle(title), brand: 'oster', category: null, imageUrl: null,
        url: `https://${id}.co/p`, basePrice: price, listPrice: null, shippingCost: 0, deliveryDays: 2, shippingKnown: true, totalCost: price, position: 0, notes: [],
      };
      return { offers: [o], notShippable: 0, fromCache: false };
    },
  };
}

const failing: StoreAdapter = { store: ref('caida'), search: async () => { throw new Error('HTTP 500'); } };
const hanging: StoreAdapter = {
  store: ref('lenta'),
  search: (_q, _c, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
};

describe('agregador federado', () => {
  it('tolera tiendas caídas o lentas y agrupa el resto', async () => {
    const agg = createAggregator(
      [okAdapter('a', 'Freidora de aire Oster 3.8 Litros', 200000), okAdapter('b', 'Freidora De Aire Oster 3.8 Litros Negro', 210000), failing, hanging],
      { storeTimeoutMs: 100 },
    );
    const r = await agg.search('freidora oster', CITIES[0]);
    expect(r.stores.map((s) => s.status)).toEqual(['ok', 'ok', 'error', 'timeout']);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].offers).toHaveLength(2);
  });

  it('cachea la respuesta por búsqueda y ciudad', async () => {
    let calls = 0;
    const counting: StoreAdapter = { ...okAdapter('a', 'Licuadora Oster', 100000), search: async (...args) => { calls++; return okAdapter('a', 'Licuadora Oster', 100000).search(...args); } };
    const agg = createAggregator([counting]);
    await agg.search('Licuadora  Oster', CITIES[0]);
    const second = await agg.search('licuadora oster', CITIES[0]);
    expect(calls).toBe(1);
    expect(second.stores[0].fromCache).toBe(true);
    await agg.search('licuadora oster', CITIES[1]);
    expect(calls).toBe(2); // otra ciudad = otro envío
  });
});

describe('orden por relevancia', () => {
  it('respeta la posición en las tiendas y sube un poco los productos comparados en varias', async () => {
    const mk = (id: string, positions: number[]) => ({
      id, name: id, brand: null, imageUrl: null,
      offers: positions.map((p, i) => ({ ...((okAdapter('s' + i, id, 1) as unknown) as object), position: p })) as never,
    });
    const sorted = sortByRelevance([mk('lejano', [9]), mk('primero', [0]), mk('comparado', [4, 6])]);
    expect(sorted.map((g) => g.id)).toEqual(['primero', 'comparado', 'lejano']);
  });
});

describe('API HTTP', () => {
  const app = buildApp({ aggregator: createAggregator([okAdapter('a', 'Licuadora Oster', 100000)]), stores: [ref('a')] });

  it('GET /api/cities y /api/stores', async () => {
    const cities = await app.inject('/api/cities');
    expect(cities.statusCode).toBe(200);
    expect(cities.json().find((c: { id: string }) => c.id === 'bogota').dane).toBe('11001');
    expect((await app.inject('/api/stores')).json()).toHaveLength(1);
  });

  it('GET /api/search valida parámetros', async () => {
    expect((await app.inject('/api/search?q=a&city=bogota')).statusCode).toBe(400);
    expect((await app.inject('/api/search?q=licuadora&city=marte')).statusCode).toBe(400);
    expect((await app.inject('/api/search?city=bogota')).statusCode).toBe(400);
  });

  it('GET /api/search devuelve grupos con la ciudad', async () => {
    const res = await app.inject('/api/search?q=licuadora&city=medellin');
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.city.name).toBe('Medellín');
    expect(body.groups[0].offers[0].url).toBe('https://a.co/p');
  });
});
