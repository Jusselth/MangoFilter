/**
 * Cliente HTTP mínimo para hablar con las tiendas: timeout, cancelación y
 * errores con el código de estado para poder reportarlos por tienda.
 */
const USER_AGENT = 'Mozilla/5.0 (compatible; MangoFilter/1.0; proyecto academico; +https://github.com/)';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} en ${new URL(url).host}`);
  }
}

export class TimeoutError extends Error {
  constructor(readonly host: string) {
    super(`Tiempo de espera agotado en ${host}`);
  }
}

export async function fetchJson<T>(
  url: string,
  init: { method?: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string>; timeoutMs: number; signal?: AbortSignal },
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(new URL(url).host)), init.timeoutMs);
  const onAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    // Algunas tiendas VTEX responden 206/406 con un cuerpo JSON válido: se acepta cualquier 2xx o un JSON parseable.
    const text = await res.text();
    if (!res.ok && res.status !== 406) throw new HttpError(res.status, url);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new HttpError(res.status, url);
    }
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof TimeoutError) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', onAbort);
  }
}
