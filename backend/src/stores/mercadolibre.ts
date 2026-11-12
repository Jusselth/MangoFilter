/**
 * Adaptador OPCIONAL de Mercado Libre Colombia (MCO).
 *
 * Mercado Libre ya no permite buscar sin autenticación (responde 403). Para
 * activarlo, registra una aplicación gratuita en
 * https://developers.mercadolibre.com.co/devcenter y define en `backend/.env`:
 *   ML_CLIENT_ID=...    ML_CLIENT_SECRET=...
 *
 * ⚠️ NO VERIFICADO EN VIVO: se escribió según la documentación oficial
 * (OAuth client_credentials, /sites/MCO/search, /items/{id}/shipping_options)
 * pero no se pudo probar sin credenciales. Si falla, el agregador lo reporta
 * como error de esa tienda y el resto sigue funcionando.
 */
import { TtlCache } from '../cache.js';
import { detectBrand, matchesQuery, normalizeBrand, normalizeTitle } from '../domain/normalize.js';
import type { City, Offer, StoreRef } from '../domain/types.js';
import { fetchJson, HttpError } from '../http.js';
import type { StoreAdapter } from './types.js';

const API = 'https://api.mercadolibre.com';

interface MeliResult {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  permalink: string;
  thumbnail?: string;
  shipping?: { free_shipping?: boolean };
  attributes?: { id: string; value_name: string | null }[];
}

interface MeliShippingOptions {
  options?: { cost?: number; estimated_delivery_time?: { date?: string } }[];
}

export function createMercadoLibreAdapter(clientId: string, clientSecret: string, timeoutMs = 6_000): StoreAdapter {
  const store: StoreRef = { id: 'mercadolibre', name: 'Mercado Libre', short: 'ML', color: '#FFE600', website: 'https://www.mercadolibre.com.co' };
  const searchCache = new TtlCache<MeliResult[]>(200);
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const res = await fetch(`${API}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new HttpError(res.status, `${API}/oauth/token`);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return token.value;
  }

  async function shippingFor(item: MeliResult, city: City, auth: string, signal: AbortSignal) {
    if (item.shipping?.free_shipping) return { cost: 0, days: null as number | null, known: true };
    try {
      const data = await fetchJson<MeliShippingOptions>(`${API}/items/${item.id}/shipping_options?zip_code=${city.postal}`, {
        headers: { authorization: `Bearer ${auth}` },
        timeoutMs,
        signal,
      });
      const options = (data.options ?? []).filter((o) => typeof o.cost === 'number');
      if (!options.length) return { cost: null, days: null, known: false };
      const best = options.sort((a, b) => a.cost! - b.cost!)[0];
      const date = best.estimated_delivery_time?.date ? new Date(best.estimated_delivery_time.date) : null;
      const days = date ? Math.max(1, Math.ceil((date.getTime() - Date.now()) / 86_400_000)) : null;
      return { cost: Math.round(best.cost!), days, known: true };
    } catch {
      return { cost: null, days: null, known: false };
    }
  }

  return {
    store,
    async search(query, city, signal) {
      const auth = await getToken();
      let results = searchCache.get(query);
      const fromCache = !!results;
      if (!results) {
        const data = await fetchJson<{ results: MeliResult[] }>(`${API}/sites/MCO/search?q=${encodeURIComponent(query)}&limit=12`, {
          headers: { authorization: `Bearer ${auth}` },
          timeoutMs,
          signal,
        });
        results = data.results ?? [];
        searchCache.set(query, results, 5 * 60_000);
      }

      const relevant = results.filter((r) => r.price > 0 && matchesQuery(r.title, query)).slice(0, 8);
      const offers: Offer[] = await Promise.all(
        relevant.map(async (r, position) => {
          const ship = await shippingFor(r, city, auth, signal);
          const brandAttr = r.attributes?.find((a) => a.id === 'BRAND')?.value_name;
          return {
            id: `mercadolibre:${r.id}`,
            store,
            title: r.title,
            normalizedTitle: normalizeTitle(r.title),
            brand: normalizeBrand(brandAttr) ?? detectBrand(r.title),
            category: null,
            imageUrl: r.thumbnail?.replace(/^http:/, 'https:') ?? null,
            url: r.permalink,
            basePrice: Math.round(r.price),
            listPrice: r.original_price && r.original_price > r.price ? Math.round(r.original_price) : null,
            shippingCost: ship.cost,
            deliveryDays: ship.days,
            shippingKnown: ship.known,
            availability: ship.known ? 'delivery' : 'unknown',
            totalCost: Math.round(r.price) + (ship.cost ?? 0),
            position,
            notes: ship.known ? [] : ['No pudimos cotizar el envío: se calcula en la tienda.'],
          } satisfies Offer;
        }),
      );
      return { offers, notShippable: 0, fromCache };
    },
  };
}
