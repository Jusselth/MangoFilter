import type { FastifyInstance } from 'fastify';

import type { Aggregator } from '../aggregator.js';
import { CITIES, findCity } from '../cities.js';
import type { StoreRef } from '../domain/types.js';
import { buildRecommendations } from '../recommendations.js';
import type { Services } from '../services.js';
import { deviceIdOf, optionalUser } from './account.js';

export const STATS_DAYS = 30;

/**
 * Actividad (anónima o con cuenta) y lo que se calcula con ella.
 *   POST   /api/events/click        registra una "vista" (clic hacia la tienda)
 *   DELETE /api/history             borra el historial del usuario o del dispositivo
 *   GET    /api/stats/top-stores    tiendas con más vistas (últimos 30 días)
 *   GET    /api/stats/trending?city lo más buscado en la ciudad (últimos 30 días)
 *   GET    /api/recommendations?city recomendaciones según la actividad real del usuario
 *
 * Las peticiones se asocian a la cuenta (Authorization) o, si no hay sesión,
 * al identificador anónimo del dispositivo (cabecera X-Device-Id).
 */
export function registerActivityRoutes(app: FastifyInstance, services: Services, aggregator: Aggregator, stores: StoreRef[]) {
  const { analytics, userData } = services;
  const storeById = new Map(stores.map((s) => [s.id, s]));

  const actorOf = async (req: Parameters<typeof optionalUser>[1]) => {
    const user = await optionalUser(services, req);
    return { user, actor: analytics.actorFor(user?.id ?? null, deviceIdOf(req)) };
  };

  app.post<{ Body: { offerId: string; storeId: string; productName: string; query?: string; city: string } }>(
    '/api/events/click',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        body: {
          type: 'object',
          required: ['offerId', 'storeId', 'productName', 'city'],
          additionalProperties: false,
          properties: {
            offerId: { type: 'string', minLength: 3, maxLength: 120 },
            storeId: { type: 'string', enum: stores.map((s) => s.id) },
            productName: { type: 'string', minLength: 1, maxLength: 300 },
            query: { type: 'string', maxLength: 80 },
            city: { type: 'string', enum: CITIES.map((c) => c.id) },
          },
        },
      },
    },
    async (req) => {
      const { actor } = await actorOf(req);
      const { offerId, storeId, productName, query, city } = req.body;
      // El ID de la oferta siempre empieza por la tienda ("jumbo:433936").
      if (!offerId.startsWith(`${storeId}:`)) return { ok: true, counted: false };
      const counted = await analytics.logClick(actor, { offerId, storeId, productName, query: query?.trim() || null, city });
      return { ok: true, counted };
    },
  );

  app.delete('/api/history', async (req) => {
    const { actor } = await actorOf(req);
    await analytics.forgetActor(actor);
    return { ok: true };
  });

  app.get('/api/stats/top-stores', async (_req, reply) => {
    const rows = await analytics.topStores(STATS_DAYS, 5);
    const ranked = rows
      .filter((r) => storeById.has(r.store_id))
      .map((r) => ({ store: storeById.get(r.store_id)!, views: r.views, people: r.people }));
    void reply.header('cache-control', 'public, max-age=60');
    return { days: STATS_DAYS, totalViews: ranked.reduce((a, r) => a + r.views, 0), stores: ranked };
  });

  app.get<{ Querystring: { city: string } }>(
    '/api/stats/trending',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['city'],
          properties: { city: { type: 'string', enum: CITIES.map((c) => c.id) } },
        },
      },
    },
    async (req, reply) => {
      const city = findCity(req.query.city)!;
      const queries = await analytics.trending(city.id, STATS_DAYS, services.trendingMinPeople, 8);
      void reply.header('cache-control', 'public, max-age=60');
      return { city, days: STATS_DAYS, minPeople: services.trendingMinPeople, queries };
    },
  );

  app.get<{ Querystring: { city: string } }>(
    '/api/recommendations',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        querystring: {
          type: 'object',
          required: ['city'],
          properties: { city: { type: 'string', enum: CITIES.map((c) => c.id) } },
        },
      },
    },
    async (req, reply) => {
      const city = findCity(req.query.city)!;
      const { user, actor } = await actorOf(req);
      const saved = user ? await userData.listSaved(user.id) : [];
      const items = await buildRecommendations({ analytics, aggregator, actor, city, excludeIds: new Set(saved.map((s) => s.id)) });
      void reply.header('cache-control', 'private, no-store');
      return { city, items };
    },
  );
}
