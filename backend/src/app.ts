import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import type { Aggregator } from './aggregator.js';
import { HttpError } from './auth/service.js';
import { CITIES, findCity } from './cities.js';
import type { StoreRef } from './domain/types.js';
import { deviceIdOf, optionalUser, registerAccountRoutes } from './routes/account.js';
import { registerActivityRoutes } from './routes/activity.js';
import type { Services } from './services.js';
import { SavedLimitError } from './userData.js';

export interface AppDeps {
  aggregator: Aggregator;
  stores: StoreRef[];
  /** Cuentas, eventos y estadísticas. Sin base de datos, esas rutas responden 503. */
  services?: Services | null;
  logger?: boolean;
  trustProxy?: boolean;
}

/**
 * API Gateway de MangoFilter.
 *   GET /api/health   estado, tiendas activas y funciones disponibles
 *   GET /api/stores   tiendas consultadas (nombre, sitio web)
 *   GET /api/cities   ciudades de entrega soportadas
 *   GET /api/search?q=&city=   búsqueda federada con envío real a la ciudad
 * + rutas de cuentas (routes/account.ts) y de actividad y estadísticas (routes/activity.ts).
 */
export function buildApp({ aggregator, stores, services = null, logger = false, trustProxy = false }: AppDeps): FastifyInstance {
  const app = Fastify({ logger, trustProxy });

  // La app web de Expo (otro puerto en desarrollo) llama a la API: se permite cualquier origen.
  // No se usan cookies, la sesión viaja en la cabecera Authorization.
  void app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-device-id'],
    maxAge: 600,
  });

  // Límite de peticiones por IP (solo en las rutas que lo declaran).
  void app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: `Demasiadas solicitudes. Intenta de nuevo en ${Math.ceil(ctx.ttl / 1000)} segundos.`,
    }),
  });

  app.after(() => {
    app.get('/api/health', async () => ({
      ok: true,
      stores: stores.map((s) => s.id),
      features: { accounts: !!services },
      time: new Date().toISOString(),
    }));

    app.get('/api/stores', async () => stores);

    app.get('/api/cities', async () => CITIES);

    app.get<{ Querystring: { q: string; city: string } }>(
      '/api/search',
      {
        config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
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

        // Registro de la búsqueda para estadísticas y recomendaciones. No retrasa la respuesta
        // y un fallo de la base de datos nunca rompe la búsqueda.
        if (services) {
          const s = services;
          void (async () => {
            const user = await optionalUser(s, req);
            await s.analytics.logSearch(s.analytics.actorFor(user?.id ?? null, deviceIdOf(req)), q, city.id, result.groups.length);
          })().catch((error: unknown) => req.log.warn({ err: error }, 'no se pudo registrar la búsqueda'));
        }

        // Respuesta reutilizable 2 minutos, pero solo en el dispositivo (puede ir con sesión).
        void reply.header('cache-control', 'private, max-age=120');
        return result;
      },
    );

    if (services) {
      registerAccountRoutes(app, services);
      registerActivityRoutes(app, services, aggregator, stores);
    } else {
      const unavailable = async (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
        reply.code(503).send({ error: 'Las cuentas y estadísticas no están configuradas en este servidor (falta la base de datos).' });
      for (const url of ['/api/auth/*', '/api/me', '/api/me/*', '/api/events/*', '/api/history', '/api/stats/*', '/api/recommendations']) {
        app.all(url, unavailable);
      }
    }
  });

  app.setErrorHandler((error, req, reply) => {
    if (error instanceof HttpError) {
      if (error.retryAfterSeconds) void reply.header('retry-after', String(error.retryAfterSeconds));
      return reply.code(error.statusCode).send({ error: error.message });
    }
    if (error instanceof SavedLimitError) return reply.code(409).send({ error: error.message });

    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) req.log.error(error);
    const message =
      status === 400
        ? `Parámetros inválidos: ${error instanceof Error ? error.message : String(error)}`
        : status === 429
          ? ((error as { error?: string }).error ?? 'Demasiadas solicitudes. Espera un momento.')
          : status >= 500
            ? 'Error interno del servidor.'
            : error instanceof Error
              ? error.message
              : 'Solicitud inválida.';
    return reply.code(status).send({ error: message });
  });

  return app;
}
