import { createHmac, randomBytes } from 'node:crypto';

import { normalizeQuery } from './aggregator.js';
import type { Db } from './db/index.js';

/**
 * Registro de búsquedas y "vistas" (clics hacia la tienda) y las estadísticas
 * que se calculan con ellos. Todo es dato real de uso de MangoFilter.
 *
 * Privacidad: cada evento lleva un `actor`, un seudónimo HMAC del usuario
 * (si inició sesión) o del identificador anónimo del dispositivo. Permite
 * contar personas distintas sin saber quiénes son. Los rankings públicos
 * solo muestran agregados.
 */

export interface Actor {
  /** Seudónimo HMAC; null si la petición no trae ni sesión ni dispositivo. */
  key: string | null;
  userId: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SEARCH_DEDUPE_MINUTES = 10;
export const CLICK_DEDUPE_MINUTES = 30;
export const RETENTION_DAYS = 365;

export interface SearchSignal {
  query: string;
  score: number;
  searches: number;
  clicks: number;
  saved: number;
}

export function createAnalytics(db: Db, secret: string) {
  const pseudonym = (kind: 'u' | 'd', id: string) => createHmac('sha256', secret).update(`actor:${kind}:${id}`).digest('hex').slice(0, 40);

  function actorFor(userId: string | null, deviceId: string | undefined | null): Actor {
    if (userId) return { key: pseudonym('u', userId), userId };
    if (deviceId && UUID_RE.test(deviceId)) return { key: pseudonym('d', deviceId.toLowerCase()), userId: null };
    return { key: null, userId: null };
  }

  async function logSearch(actor: Actor, query: string, city: string, resultCount: number): Promise<void> {
    if (!actor.key) return;
    const norm = normalizeQuery(query);
    await db.query(
      `insert into mangofilter.search_events (actor, user_id, query, query_norm, city, result_count)
       select $1, $2, $3, $4, $5, $6
        where not exists (
          select 1 from mangofilter.search_events
           where actor = $1 and query_norm = $4 and city = $5
             and created_at > now() - make_interval(mins => $7))`,
      [actor.key, actor.userId, query.trim().slice(0, 80), norm.slice(0, 80), city, resultCount, SEARCH_DEDUPE_MINUTES],
    );
  }

  /** Registra una vista. Devuelve false si era repetida (misma oferta, mismo actor, < 30 min). */
  async function logClick(
    actor: Actor,
    click: { storeId: string; offerId: string; productName: string; query: string | null; city: string },
  ): Promise<boolean> {
    if (!actor.key) return false;
    const rows = await db.query(
      `insert into mangofilter.click_events (actor, user_id, store_id, offer_id, product_name, query_norm, city)
       select $1, $2, $3, $4, $5, $6, $7
        where not exists (
          select 1 from mangofilter.click_events
           where actor = $1 and offer_id = $4 and created_at > now() - make_interval(mins => $8))
       returning id`,
      [
        actor.key,
        actor.userId,
        click.storeId,
        click.offerId,
        click.productName.slice(0, 200),
        click.query ? normalizeQuery(click.query).slice(0, 80) : null,
        click.city,
        CLICK_DEDUPE_MINUTES,
      ],
    );
    return rows.length > 0;
  }

  /** Últimas búsquedas distintas del actor (para "Búsquedas recientes"). */
  async function recentQueries(actor: Actor, limit = 8): Promise<string[]> {
    if (!actor.key) return [];
    const rows = await db.query<{ query: string }>(
      `select query from (
         select distinct on (query_norm) query, query_norm, created_at
           from mangofilter.search_events where actor = $1
          order by query_norm, created_at desc) t
        order by created_at desc limit $2`,
      [actor.key, limit],
    );
    return rows.map((r) => r.query);
  }

  /**
   * "Borrar historial": las búsquedas y vistas dejan de estar ligadas a la
   * persona. Se quita `user_id` y el seudónimo se reemplaza por otro derivado
   * de una sal aleatoria que se descarta: los conteos agregados siguen siendo
   * correctos, pero ya nadie (ni el backend) puede asociarlos a ella.
   */
  async function forgetActor(actor: Actor): Promise<void> {
    if (!actor.key) return;
    const salt = randomBytes(16).toString('hex');
    for (const table of ['search_events', 'click_events']) {
      await db.query(
        `update mangofilter.${table}
            set user_id = null, actor = left(encode(sha256(convert_to(actor || $2, 'UTF8')), 'hex'), 40)
          where actor = $1`,
        [actor.key, salt],
      );
    }
  }

  /** Al iniciar sesión, las búsquedas y vistas anónimas de ese dispositivo pasan a la cuenta. */
  async function claimDeviceEvents(device: Actor, user: Actor): Promise<void> {
    if (!device.key || !user.key || device.userId) return;
    for (const table of ['search_events', 'click_events']) {
      await db.query(`update mangofilter.${table} set actor = $2, user_id = $3 where actor = $1`, [device.key, user.key, user.userId]);
    }
  }

  /** Tiendas con más vistas en los últimos `days` días. */
  async function topStores(days: number, limit: number) {
    return db.query<{ store_id: string; views: number; people: number }>(
      `select store_id, count(*)::int as views, count(distinct actor)::int as people
         from mangofilter.click_events
        where created_at > now() - make_interval(days => $1)
        group by store_id
        order by views desc, people desc, store_id
        limit $2`,
      [days, limit],
    );
  }

  /**
   * Búsquedas más frecuentes en una ciudad. Solo entran las que dieron
   * resultados y las hicieron al menos `minPeople` personas distintas: así no
   * se publican búsquedas de una sola persona ni se puede inflar el ranking solo.
   */
  async function trending(city: string, days: number, minPeople: number, limit: number) {
    return db.query<{ query: string; people: number; searches: number }>(
      `select query_norm as query, count(distinct actor)::int as people, count(*)::int as searches
         from mangofilter.search_events
        where city = $1 and result_count > 0 and created_at > now() - make_interval(days => $2)
        group by query_norm
       having count(distinct actor) >= $3
        order by people desc, searches desc, query_norm
        limit $4`,
      [city, days, minPeople, limit],
    );
  }

  /**
   * Intereses del actor a partir de su actividad REAL de los últimos 90 días:
   * búsquedas (peso 1), vistas de ofertas (peso 3) y productos guardados
   * (peso 4), con decaimiento exponencial de 14 días (lo reciente pesa más).
   */
  async function interestSignals(actor: Actor, limit: number): Promise<SearchSignal[]> {
    if (!actor.key) return [];
    const rows = await db.query<{ query: string; score: number; searches: number; clicks: number; saved: number }>(
      `with signals as (
         select query_norm as q, 1.0 as w, 'search' as kind, created_at from mangofilter.search_events
          where actor = $1 and result_count > 0 and created_at > now() - interval '90 days'
         union all
         select query_norm, 3.0, 'click', created_at from mangofilter.click_events
          where actor = $1 and query_norm is not null and created_at > now() - interval '90 days'
         union all
         select lower(regexp_replace(trim(query), '\\s+', ' ', 'g')), 4.0, 'saved', saved_at from mangofilter.saved_products
          where user_id = $2
       )
       select q as query,
              sum(w * exp(-extract(epoch from (now() - created_at)) / 86400.0 / 14.0))::float8 as score,
              count(*) filter (where kind = 'search')::int as searches,
              count(*) filter (where kind = 'click')::int as clicks,
              count(*) filter (where kind = 'saved')::int as saved
         from signals group by q
        order by score desc limit $3`,
      [actor.key, actor.userId, limit],
    );
    return rows;
  }

  async function cleanup(): Promise<void> {
    for (const table of ['search_events', 'click_events']) {
      await db.query(`delete from mangofilter.${table} where created_at < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
    }
  }

  return { actorFor, logSearch, logClick, recentQueries, forgetActor, claimDeviceEvents, topStores, trending, interestSignals, cleanup };
}

export type Analytics = ReturnType<typeof createAnalytics>;
