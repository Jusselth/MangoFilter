import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import type { Aggregator } from './aggregator.js';
import { CITIES, findCity } from './cities.js';
import type { StoreRef } from './domain/types.js';

export interface AppDeps {
  aggregator: Aggregator;
  stores: StoreRef[];
  logger?: boolean;
}

/**
 * API Gateway de MangoFilter. Rutas de solo lectura:
 *   GET /api/health   estado y tiendas activas
 *   GET /api/stores   tiendas consultadas (nombre, sitio web)
 *   GET /api/cities   ciudades de entrega soportadas
 *   GET /api/search?q=&city=   búsqueda federada con envío real a la ciudad
 */
export function buildApp({ aggregator, stores, logger = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger });

  // API pública de solo lectura: se permite cualquier origen (app web de Expo en desarrollo).
  void app.register(cors, { origin: true, methods: ['GET'] });

  app.get('/api/health', async () => ({ ok: true, stores: stores.map((s) => s.id), time: new Date().toISOString() }));

  app.get('/api/stores', async () => stores);

  app.get('/api/cities', async () => CITIES);

  app.get<{ Querystring: { q: string; city: string } }>(
    '/api/search',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['q', 'city'],
          properties: {
            q: { type: 'string', minLength: 2, maxLength: 80 },
            city: { type: 'string', enum: CITIES.map((c) => c.id) },
          },
        },
      },
    },
    async (req, reply) => {
      const city = findCity(req.query.city)!;
      const q = req.query.q.trim();
      if (q.length < 2) return reply.code(400).send({ error: 'La búsqueda debe tener al menos 2 caracteres.' });
      const result = await aggregator.search(q, city);
      // Los navegadores/CDN pueden reutilizar la respuesta 2 minutos.
      void reply.header('cache-control', 'public, max-age=120');
      return result;
    },
  );

  app.setErrorHandler((error, _req, reply) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    void reply.code(status).send({ error: status === 400 ? `Parámetros inválidos: ${error instanceof Error ? error.message : String(error)}` : 'Error interno del servidor.' });
  });

  return app;
}
