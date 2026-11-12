import type { FastifyInstance, FastifyRequest } from 'fastify';

import { HttpError, type User } from '../auth/service.js';
import { CITIES } from '../cities.js';
import type { Services } from '../services.js';
import { SavedLimitError, type Preferences, type SavedProduct } from '../userData.js';

/* ------------------------------ Esquemas JSON ------------------------------ */

const preferencesSchema = {
  type: 'object',
  required: ['city', 'cityName', 'criterion', 'themeMode', 'haptics'],
  additionalProperties: false,
  properties: {
    city: { type: 'string', enum: CITIES.map((c) => c.id) },
    cityName: { type: 'string', minLength: 1, maxLength: 60 },
    criterion: { type: 'string', enum: ['precio', 'equilibrado', 'rapidez'] },
    themeMode: { type: 'string', enum: ['system', 'light', 'dark'] },
    haptics: { type: 'boolean' },
  },
} as const;

const savedSchema = {
  type: 'object',
  required: ['id', 'name', 'query', 'bestTotalAtSave', 'savedAt'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 120 },
    name: { type: 'string', minLength: 1, maxLength: 300 },
    imageUrl: { type: ['string', 'null'], maxLength: 1000 },
    query: { type: 'string', minLength: 2, maxLength: 80 },
    bestTotalAtSave: { type: 'number', minimum: 0, maximum: 1e12 },
    savedAt: { type: 'number', minimum: 0 },
  },
} as const;

/* -------------------------------- Ayudantes -------------------------------- */

const userCache = new WeakMap<FastifyRequest, User | null>();

export function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  const m = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return m ? m[1] : null;
}

/** Usuario de la sesión (o null). Se consulta una sola vez por petición. */
export async function optionalUser(services: Services, req: FastifyRequest): Promise<User | null> {
  if (userCache.has(req)) return userCache.get(req)!;
  const token = bearerToken(req);
  const user = token ? await services.auth.authenticate(token) : null;
  userCache.set(req, user);
  return user;
}

export async function requireUser(services: Services, req: FastifyRequest): Promise<User> {
  const user = await optionalUser(services, req);
  if (!user) throw new HttpError(401, 'Tu sesión venció. Vuelve a iniciar sesión.');
  return user;
}

export const deviceIdOf = (req: FastifyRequest) => {
  const v = req.headers['x-device-id'];
  return typeof v === 'string' ? v : null;
};

/* ---------------------------------- Rutas ---------------------------------- */

/**
 * Cuentas sin contraseña (código por correo) y datos de cada usuario.
 *   POST   /api/auth/code      { email }                       → envía el código
 *   POST   /api/auth/verify    { email, code, acceptPrivacy? } → { token, user, isNew }
 *   POST   /api/auth/logout
 *   GET    /api/me             → { user, preferences, saved, history }
 *   POST   /api/me/sync        { preferences?, saved[] }       → une los datos del invitado a la cuenta
 *   PUT    /api/me/preferences
 *   PUT    /api/me/saved       (un producto)   ·   DELETE /api/me/saved/:id
 *   DELETE /api/me             → borra la cuenta
 */
export function registerAccountRoutes(app: FastifyInstance, services: Services) {
  const { auth, analytics, userData } = services;

  async function profile(user: User, deviceId: string | null) {
    const actor = analytics.actorFor(user.id, deviceId);
    const [preferences, saved, history] = await Promise.all([
      userData.getPreferences(user.id),
      userData.listSaved(user.id),
      analytics.recentQueries(actor),
    ]);
    return { user, preferences, saved, history };
  }

  app.post<{ Body: { email: string } }>(
    '/api/auth/code',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          additionalProperties: false,
          properties: { email: { type: 'string', minLength: 3, maxLength: 254 } },
        },
      },
    },
    async (req) => {
      const { email, expiresInMinutes } = await auth.requestCode(req.body.email, req.ip);
      return { ok: true, email, expiresInMinutes };
    },
  );

  app.post<{ Body: { email: string; code: string; acceptPrivacy?: boolean } }>(
    '/api/auth/verify',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'code'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', minLength: 3, maxLength: 254 },
            code: { type: 'string', minLength: 6, maxLength: 12 },
            acceptPrivacy: { type: 'boolean' },
          },
        },
      },
    },
    async (req) => {
      const result = await auth.verifyCode(req.body.email, req.body.code, {
        acceptPrivacy: req.body.acceptPrivacy,
        userAgent: req.headers['user-agent'] ?? null,
      });
      return result;
    },
  );

  app.post('/api/auth/logout', async (req) => {
    const token = bearerToken(req);
    if (token) await auth.logout(token);
    return { ok: true };
  });

  app.get('/api/me', async (req) => profile(await requireUser(services, req), deviceIdOf(req)));

  app.post<{ Body: { preferences?: Preferences; saved: SavedProduct[] } }>(
    '/api/me/sync',
    {
      schema: {
        body: {
          type: 'object',
          required: ['saved'],
          additionalProperties: false,
          properties: { preferences: preferencesSchema, saved: { type: 'array', maxItems: 200, items: savedSchema } },
        },
      },
    },
    async (req) => {
      const user = await requireUser(services, req);
      const deviceId = deviceIdOf(req);
      if (req.body.preferences) await userData.putPreferences(user.id, req.body.preferences, true);
      await userData.addSaved(user.id, req.body.saved).catch((e: unknown) => {
        if (!(e instanceof SavedLimitError)) throw e; // al sincronizar, lo que exceda el máximo simplemente no se sube
      });
      await analytics.claimDeviceEvents(analytics.actorFor(null, deviceId), analytics.actorFor(user.id, null));
      return profile(user, deviceId);
    },
  );

  app.put<{ Body: Preferences }>('/api/me/preferences', { schema: { body: preferencesSchema } }, async (req) => {
    const user = await requireUser(services, req);
    await userData.putPreferences(user.id, req.body);
    return { ok: true };
  });

  app.put<{ Body: SavedProduct }>('/api/me/saved', { schema: { body: savedSchema } }, async (req) => {
    const user = await requireUser(services, req);
    await userData.addSaved(user.id, [req.body]);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>('/api/me/saved/:id', async (req) => {
    const user = await requireUser(services, req);
    await userData.removeSaved(user.id, req.params.id);
    return { ok: true };
  });

  app.delete('/api/me', async (req) => {
    const user = await requireUser(services, req);
    // Primero se desvinculan búsquedas y vistas (los totales anónimos se conservan), luego se borra todo lo demás.
    await analytics.forgetActor(analytics.actorFor(user.id, null));
    await userData.deleteUser(user.id);
    return { ok: true };
  });
}
