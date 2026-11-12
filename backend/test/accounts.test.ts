/**
 * Pruebas de integración de cuentas, eventos, estadísticas y recomendaciones.
 * Usan PGlite: PostgreSQL REAL compilado a WebAssembly, en memoria, con el
 * mismo backend/db/schema.sql que se ejecuta en Supabase.
 */
import { readFileSync } from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAggregator } from '../src/aggregator.js';
import { buildApp } from '../src/app.js';
import type { Mailer } from '../src/auth/mailer.js';
import type { Db } from '../src/db/index.js';
import { normalizeTitle } from '../src/domain/normalize.js';
import type { Offer, StoreRef } from '../src/domain/types.js';
import { createServices } from '../src/services.js';
import type { StoreAdapter } from '../src/stores/types.js';

const SECRET = 'x'.repeat(40);
const DEVICE_A = '11111111-1111-4111-8111-111111111111';
const DEVICE_B = '22222222-2222-4222-8222-222222222222';
const DEVICE_C = '33333333-3333-4333-8333-333333333333';

const store: StoreRef = { id: 'tienda', name: 'Tienda', short: 'TI', color: '#000', website: 'https://tienda.co' };
const adapter: StoreAdapter = {
  store,
  async search(query) {
    const title = `${query} Oster Modelo X`;
    const o: Offer = {
      id: `tienda:${normalizeTitle(query).replace(/\s/g, '-')}`, store, title, normalizedTitle: normalizeTitle(title), brand: 'oster',
      category: null, imageUrl: null, url: 'https://tienda.co/p', basePrice: 100000, listPrice: null, shippingCost: 0,
      deliveryDays: 2, shippingKnown: true, availability: 'delivery', totalCost: 100000, position: 0, notes: [],
    };
    return { offers: [o], notShippable: 0, fromCache: false };
  },
};

let pg: PGlite;
let db: Db;
let app: FastifyInstance;
const inbox: { email: string; code: string }[] = [];
const mailer: Mailer = { sendLoginCode: async (email, code) => void inbox.push({ email, code }) };
const lastCode = (email: string) => [...inbox].reverse().find((m) => m.email === email)!.code;

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('waitFor: tiempo agotado');
}
const count = async (table: string) => (await db.query<{ n: number }>(`select count(*)::int as n from mangofilter.${table}`))[0].n;

async function login(email: string, deviceId?: string): Promise<string> {
  const headers = deviceId ? { 'x-device-id': deviceId } : {};
  // Simula que pasó más de un minuto desde el último código (límite de reenvío).
  await db.query(`update mangofilter.login_codes set created_at = created_at - interval '2 minutes' where email = $1`, [email.toLowerCase()]);
  expect((await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email }, headers })).statusCode).toBe(200);
  const res = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email, code: lastCode(email.toLowerCase()), acceptPrivacy: true }, headers });
  expect(res.statusCode).toBe(200);
  return res.json().token;
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  db = { query: async (text, params) => (await pg.query(text, params)).rows as never, close: () => pg.close() };
  const services = createServices(db, mailer, { authSecret: SECRET, trendingMinPeople: 2 });
  app = buildApp({ aggregator: createAggregator([adapter]), stores: [store], services });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pg.close();
});

describe('inicio de sesión con código por correo', () => {
  it('envía un código de 6 dígitos y no guarda el código en claro', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: '  Ana@Correo.com ' } });
    expect(res.statusCode).toBe(200);
    const code = lastCode('ana@correo.com');
    expect(code).toMatch(/^\d{6}$/);
    const [row] = await db.query<{ code_hash: string }>(`select code_hash from mangofilter.login_codes where email = 'ana@correo.com'`);
    expect(row.code_hash).not.toContain(code);
  });

  it('no deja pedir otro código antes de un minuto', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'ana@correo.com' } });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('rechaza correos inválidos', async () => {
    expect((await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'no-es-correo' } })).statusCode).toBe(400);
  });

  it('código incorrecto descuenta intentos; cuenta nueva exige aceptar privacidad', async () => {
    const wrong = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'ana@correo.com', code: '000000' === lastCode('ana@correo.com') ? '000001' : '000000' } });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error).toContain('Te quedan 4 intentos');

    const noConsent = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'ana@correo.com', code: lastCode('ana@correo.com') } });
    expect(noConsent.statusCode).toBe(400);
    expect(noConsent.json().error).toContain('aviso de privacidad');

    const ok = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'ana@correo.com', code: lastCode('ana@correo.com'), acceptPrivacy: true } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ isNew: true, user: { email: 'ana@correo.com' } });
    expect(ok.json().token.length).toBeGreaterThan(30);

    // El código ya se usó.
    const reuse = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'ana@correo.com', code: lastCode('ana@correo.com') } });
    expect(reuse.statusCode).toBe(400);
  });

  it('bloquea tras 5 intentos fallidos y rechaza códigos vencidos', async () => {
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'beto@correo.com' } });
    const bad = lastCode('beto@correo.com') === '123456' ? '654321' : '123456';
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'beto@correo.com', code: bad } });
    const locked = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'beto@correo.com', code: lastCode('beto@correo.com'), acceptPrivacy: true } });
    expect(locked.statusCode).toBe(429);

    await db.query(`update mangofilter.login_codes set created_at = now() - interval '2 minutes', attempts = 0 where email = 'beto@correo.com'`);
    await app.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'beto@correo.com' } });
    await db.query(`update mangofilter.login_codes set expires_at = now() - interval '1 second' where email = 'beto@correo.com'`);
    const expired = await app.inject({ method: 'POST', url: '/api/auth/verify', payload: { email: 'beto@correo.com', code: lastCode('beto@correo.com'), acceptPrivacy: true } });
    expect(expired.statusCode).toBe(400);
    expect(expired.json().error).toContain('venció');
  });
});

describe('datos de la cuenta', () => {
  let token: string;
  const auth = () => ({ authorization: `Bearer ${token}` });
  const prefs = { city: 'medellin', cityName: 'Medellín', criterion: 'precio', themeMode: 'dark', haptics: false };
  const item = { id: 'jumbo:1', name: 'Freidora Oster', imageUrl: null, query: 'freidora', bestTotalAtSave: 199900, savedAt: Date.now() };

  beforeAll(async () => {
    token = await login('carla@correo.com');
  });

  it('GET /api/me exige sesión válida', async () => {
    expect((await app.inject('/api/me')).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/me', headers: { authorization: 'Bearer inventado' } })).statusCode).toBe(401);
    const me = await app.inject({ url: '/api/me', headers: auth() });
    expect(me.json()).toMatchObject({ user: { email: 'carla@correo.com' }, preferences: null, saved: [], history: [] });
  });

  it('guarda preferencias y productos, y los devuelve al volver a entrar', async () => {
    expect((await app.inject({ method: 'PUT', url: '/api/me/preferences', payload: prefs, headers: auth() })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/api/me/saved', payload: item, headers: auth() })).statusCode).toBe(200);

    const again = await login('carla@correo.com'); // otro dispositivo / nuevo inicio de sesión
    const me = (await app.inject({ url: '/api/me', headers: { authorization: `Bearer ${again}` } })).json();
    expect(me.preferences).toEqual(prefs);
    expect(me.saved).toHaveLength(1);
    expect(me.saved[0]).toMatchObject({ id: 'jumbo:1', bestTotalAtSave: 199900 });
    expect(Math.abs(me.saved[0].savedAt - item.savedAt)).toBeLessThan(1000);

    expect((await app.inject({ method: 'DELETE', url: `/api/me/saved/${encodeURIComponent('jumbo:1')}`, headers: auth() })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/me', headers: auth() })).json().saved).toHaveLength(0);
  });

  it('valida preferencias (ciudad desconocida → 400)', async () => {
    const res = await app.inject({ method: 'PUT', url: '/api/me/preferences', payload: { ...prefs, city: 'marte' }, headers: auth() });
    expect(res.statusCode).toBe(400);
  });

  it('sync une los guardados del invitado sin pisar las preferencias de la cuenta', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sync',
      payload: { preferences: { ...prefs, city: 'cali', cityName: 'Cali' }, saved: [item, { ...item, id: 'olimpica:2' }] },
      headers: auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().preferences.city).toBe('medellin');
    expect(res.json().saved.map((s: { id: string }) => s.id).sort()).toEqual(['jumbo:1', 'olimpica:2']);
  });

  it('cerrar sesión invalida el token', async () => {
    const t = await login('carla@correo.com');
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${t}` } });
    expect((await app.inject({ url: '/api/me', headers: { authorization: `Bearer ${t}` } })).statusCode).toBe(401);
  });
});

describe('búsquedas, vistas y estadísticas', () => {
  const search = (q: string, device: string, city = 'bogota', extra: Record<string, string> = {}) =>
    app.inject({ url: `/api/search?q=${encodeURIComponent(q)}&city=${city}`, headers: { 'x-device-id': device, ...extra } });

  it('registra la búsqueda de forma anónima y sin duplicar en 10 minutos', async () => {
    const before = await count('search_events');
    await search('licuadora', DEVICE_A);
    await waitFor(() => count('search_events'), (n) => n === before + 1);
    await search('Licuadora ', DEVICE_A);
    await new Promise((r) => setTimeout(r, 80));
    expect(await count('search_events')).toBe(before + 1);
    // Sin dispositivo ni sesión (p. ej. curl) no se registra nada.
    await app.inject('/api/search?q=nevera&city=bogota');
    await new Promise((r) => setTimeout(r, 80));
    expect(await count('search_events')).toBe(before + 1);
  });

  it('"lo más buscado" exige un mínimo de personas distintas y es por ciudad', async () => {
    const trending = async (city: string) => (await app.inject(`/api/stats/trending?city=${city}`)).json().queries as { query: string; people: number }[];
    expect(await trending('bogota')).toEqual([]); // 1 persona < mínimo (2)
    const before = await count('search_events');
    await search('licuadora', DEVICE_B);
    await waitFor(() => count('search_events'), (n) => n === before + 1);
    expect(await trending('bogota')).toEqual([{ query: 'licuadora', people: 2, searches: 2 }]);
    expect(await trending('cali')).toEqual([]);
  });

  it('una vista se cuenta una vez por oferta y persona cada 30 minutos', async () => {
    const click = (device: string) =>
      app.inject({
        method: 'POST',
        url: '/api/events/click',
        headers: { 'x-device-id': device },
        payload: { offerId: 'tienda:licuadora', storeId: 'tienda', productName: 'Licuadora Oster', query: 'licuadora', city: 'bogota' },
      });
    expect((await click(DEVICE_A)).json().counted).toBe(true);
    expect((await click(DEVICE_A)).json().counted).toBe(false);
    expect((await click(DEVICE_B)).json().counted).toBe(true);
    const top = (await app.inject('/api/stats/top-stores')).json();
    expect(top).toMatchObject({ days: 30, totalViews: 2, stores: [{ store: { id: 'tienda' }, views: 2, people: 2 }] });

    // Tienda que no existe → rechazada por el esquema.
    const bad = await app.inject({
      method: 'POST',
      url: '/api/events/click',
      headers: { 'x-device-id': DEVICE_A },
      payload: { offerId: 'otra:1', storeId: 'otra', productName: 'X', city: 'bogota' },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('recomienda según la actividad real del dispositivo', async () => {
    const recs = (await app.inject({ url: '/api/recommendations?city=bogota', headers: { 'x-device-id': DEVICE_A } })).json();
    expect(recs.items).toHaveLength(1);
    expect(recs.items[0]).toMatchObject({ query: 'licuadora', reason: 'Porque viste ofertas de «licuadora»' });
    expect(recs.items[0].group.offers[0].store.id).toBe('tienda');
    // Un dispositivo sin actividad no recibe recomendaciones inventadas.
    expect((await app.inject({ url: '/api/recommendations?city=bogota', headers: { 'x-device-id': DEVICE_C } })).json().items).toEqual([]);
  });

  it('al iniciar sesión, el historial del dispositivo pasa a la cuenta', async () => {
    const token = await login('dani@correo.com', DEVICE_A);
    const me = await app.inject({ method: 'POST', url: '/api/me/sync', payload: { saved: [] }, headers: { authorization: `Bearer ${token}`, 'x-device-id': DEVICE_A } });
    expect(me.json().history).toEqual(['licuadora']);

    // Las búsquedas con sesión quedan en la cuenta.
    const before = await count('search_events');
    await search('nevera samsung', DEVICE_A, 'bogota', { authorization: `Bearer ${token}` });
    await waitFor(() => count('search_events'), (n) => n === before + 1);
    expect((await app.inject({ url: '/api/me', headers: { authorization: `Bearer ${token}` } })).json().history).toEqual(['nevera samsung', 'licuadora']);

    // Borrar historial: desaparece de la cuenta, pero los totales anónimos se mantienen.
    await app.inject({ method: 'DELETE', url: '/api/history', headers: { authorization: `Bearer ${token}` } });
    expect((await app.inject({ url: '/api/me', headers: { authorization: `Bearer ${token}` } })).json().history).toEqual([]);
    expect((await app.inject('/api/stats/trending?city=bogota')).json().queries[0]).toMatchObject({ query: 'licuadora', people: 2 });
    expect((await db.query(`select 1 from mangofilter.search_events where user_id is not null`)).length).toBe(0);
  });

  it('borrar la cuenta elimina sus datos y la sesión', async () => {
    const token = await login('eva@correo.com');
    const h = { authorization: `Bearer ${token}` };
    await app.inject({ method: 'PUT', url: '/api/me/saved', payload: { id: 'a:1', name: 'X', imageUrl: null, query: 'xx', bestTotalAtSave: 1, savedAt: Date.now() }, headers: h });
    expect((await app.inject({ method: 'DELETE', url: '/api/me', headers: h })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/me', headers: h })).statusCode).toBe(401);
    expect((await db.query(`select 1 from mangofilter.users where email = 'eva@correo.com'`)).length).toBe(0);
    expect((await db.query(`select 1 from mangofilter.saved_products where product_id = 'a:1'`)).length).toBe(0);
  });
});

describe('sin base de datos', () => {
  it('la búsqueda funciona y las rutas de cuentas responden 503', async () => {
    const bare = buildApp({ aggregator: createAggregator([adapter]), stores: [store] });
    expect((await bare.inject('/api/health')).json().features).toEqual({ accounts: false });
    expect((await bare.inject('/api/me')).statusCode).toBe(503);
    expect((await bare.inject({ method: 'POST', url: '/api/auth/code', payload: { email: 'a@b.co' } })).statusCode).toBe(503);
    expect((await bare.inject('/api/search?q=licuadora&city=bogota')).statusCode).toBe(200);
    await bare.close();
  });
});
