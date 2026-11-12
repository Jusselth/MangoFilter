import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import type { Db } from '../db/index.js';
import type { Mailer } from './mailer.js';

/** Error con código HTTP y mensaje listo para mostrar al usuario. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
export const SESSION_DAYS = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'Escribe un correo electrónico válido.');
  return email;
}

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export interface AuthServiceDeps {
  db: Db;
  mailer: Mailer;
  secret: string;
  /** Inyectable en pruebas. */
  generateCode?: () => string;
}

/**
 * Inicio de sesión SIN contraseña: el usuario escribe su correo, recibe un
 * código de 6 dígitos y con él entra (si es la primera vez, se crea la cuenta).
 *
 * Seguridad:
 *  - El código se guarda como HMAC-SHA256 (con AUTH_SECRET), nunca en claro.
 *  - Vence en 10 min, sirve una sola vez, máximo 5 intentos; pedir uno nuevo invalida el anterior.
 *  - Máximo 1 código por minuto y 5 por hora por correo (además del límite por IP de la ruta).
 *  - La sesión es un token aleatorio de 256 bits; en la base solo queda su SHA-256.
 *  - Las respuestas no revelan si un correo ya tiene cuenta.
 */
export function createAuthService({ db, mailer, secret, generateCode }: AuthServiceDeps) {
  const newCode = generateCode ?? (() => randomInt(0, 1_000_000).toString().padStart(6, '0'));
  const hashCode = (email: string, code: string) => createHmac('sha256', secret).update(`login:${email}:${code}`).digest('hex');

  async function requestCode(rawEmail: string, ip: string | null): Promise<{ email: string; expiresInMinutes: number }> {
    const email = normalizeEmail(rawEmail);
    const [recent] = await db.query<{ last_minute: number; last_hour: number; wait: number | null }>(
      `select count(*) filter (where created_at > now() - make_interval(secs => $2))::int as last_minute,
              count(*) filter (where created_at > now() - interval '1 hour')::int as last_hour,
              ceil(extract(epoch from (max(created_at) + make_interval(secs => $2) - now())))::int as wait
         from mangofilter.login_codes where email = $1`,
      [email, RESEND_SECONDS],
    );
    if (recent.last_minute > 0) {
      const wait = Math.max(1, recent.wait ?? RESEND_SECONDS);
      throw new HttpError(429, `Espera ${wait} segundos antes de pedir otro código.`, wait);
    }
    if (recent.last_hour >= MAX_CODES_PER_HOUR) {
      throw new HttpError(429, 'Pediste demasiados códigos. Intenta de nuevo en una hora.', 3600);
    }

    const code = newCode();
    await db.query(`update mangofilter.login_codes set consumed_at = now() where email = $1 and consumed_at is null`, [email]);
    const [row] = await db.query<{ id: string }>(
      `insert into mangofilter.login_codes (email, code_hash, expires_at, requested_ip)
       values ($1, $2, now() + make_interval(mins => $3), $4) returning id`,
      [email, hashCode(email, code), CODE_TTL_MINUTES, ip],
    );
    try {
      await mailer.sendLoginCode(email, code);
    } catch (error) {
      await db.query(`delete from mangofilter.login_codes where id = $1`, [row.id]);
      console.error('[auth] no se pudo enviar el correo:', error instanceof Error ? error.message : error);
      throw new HttpError(502, 'No pudimos enviar el correo en este momento. Intenta de nuevo en unos minutos.');
    }
    return { email, expiresInMinutes: CODE_TTL_MINUTES };
  }

  async function verifyCode(
    rawEmail: string,
    rawCode: string,
    opts: { acceptPrivacy?: boolean; userAgent?: string | null },
  ): Promise<{ token: string; user: User; isNew: boolean }> {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.replace(/\D/g, '');
    if (code.length !== 6) throw new HttpError(400, 'El código tiene 6 dígitos.');

    const [pending] = await db.query<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
      `select id, code_hash, attempts, expires_at <= now() as expired
         from mangofilter.login_codes
        where email = $1 and consumed_at is null
        order by created_at desc limit 1`,
      [email],
    );
    if (!pending || pending.expired) throw new HttpError(400, 'El código venció o no existe. Pide uno nuevo.');
    if (pending.attempts >= MAX_ATTEMPTS) throw new HttpError(429, 'Demasiados intentos. Pide un código nuevo.');

    const expected = Buffer.from(pending.code_hash, 'hex');
    const given = Buffer.from(hashCode(email, code), 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      const [{ attempts }] = await db.query<{ attempts: number }>(
        `update mangofilter.login_codes set attempts = attempts + 1 where id = $1 returning attempts`,
        [pending.id],
      );
      const left = MAX_ATTEMPTS - attempts;
      throw new HttpError(400, left > 0 ? `Código incorrecto. Te quedan ${left} ${left === 1 ? 'intento' : 'intentos'}.` : 'Código incorrecto. Pide uno nuevo.');
    }

    const [existing] = await db.query<{ id: string }>(`select id from mangofilter.users where email = $1`, [email]);
    if (!existing && !opts.acceptPrivacy) {
      throw new HttpError(400, 'Para crear tu cuenta debes aceptar el aviso de privacidad.');
    }

    // Consumo atómico: si dos peticiones llegan a la vez, solo una gana.
    const consumed = await db.query(
      `update mangofilter.login_codes set consumed_at = now() where id = $1 and consumed_at is null returning id`,
      [pending.id],
    );
    if (consumed.length === 0) throw new HttpError(400, 'El código ya se usó. Pide uno nuevo.');

    const [user] = await db.query<{ id: string; email: string; created_at: Date; is_new: boolean }>(
      `insert into mangofilter.users (email, privacy_accepted_at, last_login_at) values ($1, now(), now())
       on conflict (email) do update set last_login_at = now()
       returning id, email, created_at, (xmax = 0) as is_new`,
      [email],
    );

    const token = randomBytes(32).toString('base64url');
    await db.query(
      `insert into mangofilter.sessions (user_id, token_hash, expires_at, user_agent)
       values ($1, $2, now() + make_interval(days => $3), $4)`,
      [user.id, sha256(token), SESSION_DAYS, opts.userAgent?.slice(0, 300) ?? null],
    );
    return { token, user: { id: user.id, email: user.email, createdAt: new Date(user.created_at).toISOString() }, isNew: user.is_new };
  }

  /** Devuelve el usuario de un token válido. La sesión se extiende al usarse (como mucho una escritura al día). */
  async function authenticate(token: string): Promise<User | null> {
    if (!token || token.length > 100) return null;
    const [row] = await db.query<{ session_id: string; id: string; email: string; created_at: Date; stale: boolean }>(
      `select s.id as session_id, u.id, u.email, u.created_at, s.last_used_at < now() - interval '1 day' as stale
         from mangofilter.sessions s join mangofilter.users u on u.id = s.user_id
        where s.token_hash = $1 and s.expires_at > now()`,
      [sha256(token)],
    );
    if (!row) return null;
    if (row.stale) {
      await db.query(
        `update mangofilter.sessions set last_used_at = now(), expires_at = now() + make_interval(days => $2) where id = $1`,
        [row.session_id, SESSION_DAYS],
      );
    }
    return { id: row.id, email: row.email, createdAt: new Date(row.created_at).toISOString() };
  }

  async function logout(token: string): Promise<void> {
    await db.query(`delete from mangofilter.sessions where token_hash = $1`, [sha256(token)]);
  }

  /** Limpieza periódica: códigos de más de un día y sesiones vencidas. */
  async function cleanup(): Promise<void> {
    await db.query(`delete from mangofilter.login_codes where created_at < now() - interval '1 day'`);
    await db.query(`delete from mangofilter.sessions where expires_at < now()`);
  }

  return { requestCode, verifyCode, authenticate, logout, cleanup };
}

export type AuthService = ReturnType<typeof createAuthService>;
