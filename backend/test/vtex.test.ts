import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { CITIES } from '../src/cities.js';
import { createVtexAdapter, parseShippingEstimate, type VtexSearchResponse, type VtexSimulationResponse } from '../src/stores/vtex.js';

/** Respuestas REALES capturadas de jumbocolombia.com (scripts/capture-fixtures.mjs). */
const search = JSON.parse(readFileSync(new URL('./fixtures/jumbo-search.json', import.meta.url), 'utf8')) as VtexSearchResponse;
const simulation = JSON.parse(readFileSync(new URL('./fixtures/jumbo-simulation.json', import.meta.url), 'utf8')) as VtexSimulationResponse;

const bogota = CITIES.find((c) => c.id === 'bogota')!;
const store = { id: 'jumbo', name: 'Jumbo', short: 'JU', color: '#00A651', website: 'https://www.jumbocolombia.com' };

function fakeHttp(sim: VtexSimulationResponse | Error = simulation) {
  return vi.fn(async (url: string, init: { method?: string; body?: unknown }) => {
    if (url.includes('intelligent-search')) return search;
    if (url.includes('simulation')) {
      if (sim instanceof Error) throw sim;
      return sim;
    }
    throw new Error('URL inesperada ' + url);
  }) as never;
}

describe('parseShippingEstimate', () => {
  it('interpreta los formatos de VTEX', () => {
    expect(parseShippingEstimate('3bd')).toBe(3);
    expect(parseShippingEstimate('5d')).toBe(5);
    expect(parseShippingEstimate('36h')).toBe(2);
    expect(parseShippingEstimate('raro')).toBeNull();
  });
});

describe('adaptador VTEX con respuestas reales', () => {
  it('normaliza precio regional, envío, imagen y enlace', async () => {
    const http = fakeHttp();
    const adapter = createVtexAdapter(store, { fetchJson: http });
    const { offers } = await adapter.search('televisor samsung 55', bogota, new AbortController().signal);

    expect(offers.length).toBeGreaterThan(0);
    const o = offers[0];
    expect(o.id).toMatch(/^jumbo:\d+$/);
    expect(o.url).toMatch(/^https:\/\/www\.jumbocolombia\.com\/.+\/p$/);
    expect(o.imageUrl).toMatch(/^https:\/\//);
    expect(o.basePrice).toBeGreaterThan(100_000);
    expect(o.shippingKnown).toBe(true);
    expect(o.totalCost).toBe(o.basePrice + (o.shippingCost ?? 0));
    expect(o.brand).toBe('samsung');

    // La simulación se pide con el código DANE como código postal.
    const simCall = (http as unknown as { mock: { calls: [string, { body: { postalCode: string; country: string } }][] } }).mock.calls.find((c) =>
      c[0].includes('simulation'),
    )!;
    expect(simCall[1].body).toMatchObject({ country: 'COL', postalCode: '11001' });
  });

  it('conserva y marca como "no despacha" los productos sin opciones de envío', async () => {
    const noShipping: VtexSimulationResponse = { ...simulation, logisticsInfo: simulation.logisticsInfo!.map((l) => ({ ...l, slas: [] })) };
    const adapter = createVtexAdapter(store, { fetchJson: fakeHttp(noShipping) });
    const result = await adapter.search('televisor samsung 55', bogota, new AbortController().signal);
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.notShippable).toBe(result.offers.length);
    for (const o of result.offers) {
      expect(o.availability).toBe('no_delivery');
      expect(o.shippingKnown).toBe(false);
      expect(o.shippingCost).toBeNull();
      expect(o.notes.join(' ')).toContain('no despacha este producto a Bogotá');
    }
  });

  it('marca como "solo recogida" lo que únicamente se puede recoger en tienda', async () => {
    const pickupOnly: VtexSimulationResponse = {
      ...simulation,
      logisticsInfo: simulation.logisticsInfo!.map((l) => ({
        ...l,
        slas: [{ id: 'tienda', name: 'Recoge en tienda', deliveryChannel: 'pickup-in-point', price: 0, shippingEstimate: '1bd' }],
      })),
    };
    const adapter = createVtexAdapter(store, { fetchJson: fakeHttp(pickupOnly) });
    const { offers } = await adapter.search('televisor samsung 55', bogota, new AbortController().signal);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.availability === 'pickup' && o.deliveryDays === null)).toBe(true);
  });

  it('descarta lo que la simulación reporta sin stock (respuesta real de Carulla)', async () => {
    const carSearch = JSON.parse(readFileSync(new URL('./fixtures/carulla-search.json', import.meta.url), 'utf8')) as VtexSearchResponse;
    const carSim = JSON.parse(readFileSync(new URL('./fixtures/carulla-simulation.json', import.meta.url), 'utf8')) as VtexSimulationResponse;
    const http = vi.fn(async (url: string) => (url.includes('intelligent-search') ? carSearch : carSim)) as never;
    const carulla = { id: 'carulla', name: 'Carulla', short: 'CA', color: '#00553A', website: 'https://www.carulla.com' };
    const { offers } = await createVtexAdapter(carulla, { fetchJson: http }).search('televisor samsung', bogota, new AbortController().signal);
    // 4 productos en la búsqueda; el primero viene "withoutStock" en la simulación.
    expect(offers).toHaveLength(3);
    expect(offers.every((o) => o.availability === 'delivery')).toBe(true);
  });

  it('si falla la simulación usa el precio publicado y marca el envío como desconocido', async () => {
    const adapter = createVtexAdapter(store, { fetchJson: fakeHttp(new Error('500')) });
    const { offers } = await adapter.search('televisor samsung 55', bogota, new AbortController().signal);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => !o.shippingKnown && o.shippingCost === null)).toBe(true);
  });

  it('usa la caché para no repetir consultas a la tienda', async () => {
    const http = fakeHttp();
    const adapter = createVtexAdapter(store, { fetchJson: http });
    await adapter.search('televisor samsung 55', bogota, new AbortController().signal);
    const second = await adapter.search('televisor samsung 55', bogota, new AbortController().signal);
    expect(second.fromCache).toBe(true);
    expect((http as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2); // 1 búsqueda + 1 simulación
  });
});
